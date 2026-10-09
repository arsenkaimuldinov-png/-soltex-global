/**
 * Editor of one record of a content collection (review §X editor; docs/admin-content.md §5).
 * Sections from model.ts, the sticky save bar (⌘S), unsaved-changes guard, optimistic locking
 * (If-Match; a conflict never overwrites), field-level read-only state from the user's permissions
 * (the API checks every field again), archive / restore of drafts with a confirmation.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Archive, ArchiveRestore } from 'lucide-react';
import { api, isApiError } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import { useCan } from '../../lib/session';
import { useUnsavedChangesGuard } from '../../lib/unsaved';
import { Advanced, TechValue } from '../../components/ui/Advanced';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Card, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { NotFoundPage } from '../../app/ErrorPages';
import { buildPatch, toForm, validateAll, type FormValues } from './form';
import { COLLECTION_UI, COLLECTIONS, fieldPermission, SECTION_LABELS, type CollectionName, type FieldDef, type SectionId } from './model';
import { HistoryPanel } from '../publishing/HistoryPanel';
import { PublishButtons } from '../publishing/PublishButtons';
import { apiFieldErrors, ConflictAlert, EditorBar, saveErrorMessage, StatusBadge, TranslationsCard, type ContentStatus } from './shared';
import {
  BoolField,
  EnumField,
  MediaField,
  MediaListField,
  PairListField,
  PatentInfoField,
  PlacementsField,
  PositionField,
  RefField,
  RefListField,
  TextField,
  TextListField,
  type FieldProps,
} from './fields';

interface RecordLike {
  id: string;
  key: string;
  status: ContentStatus;
  position: number;
  version: number;
  sourceLocale: string;
  createdAt: string;
  updatedAt: string;
  updatedBy: { id: string; name: string } | null;
  translations: Record<string, { status: 'missing' | 'in_progress' | 'approved' }>;
  fields: Record<string, unknown>;
}

export const recordKey = (collection: string, id: string) => ['content', collection, 'record', id] as const;

/** One input, chosen by the field kind. */
export function ContentField(props: FieldProps<any>) {
  switch (props.def.kind) {
    case 'bool':
      return <BoolField {...props} />;
    case 'enumNull':
      return <EnumField {...props} />;
    case 'placements':
      return <PlacementsField {...props} />;
    case 'list':
    case 'listNull':
      return <TextListField {...props} />;
    case 'labelValue':
    case 'titleDesc':
    case 'titleDescNull':
      return <PairListField {...props} />;
    case 'patentInfo':
      return <PatentInfoField {...props} />;
    case 'media':
    case 'mediaNull':
      return <MediaField {...props} />;
    case 'mediaList':
      return <MediaListField {...props} />;
    case 'ref':
      return <RefField {...props} />;
    case 'refList':
      return <RefListField {...props} />;
    case 'position':
      return <PositionField {...props} />;
    default:
      return <TextField {...props} />;
  }
}

export function CollectionEditorPage() {
  const { collection = '', id = '' } = useParams();
  if (!(COLLECTIONS as readonly string[]).includes(collection)) return <NotFoundPage />;
  return <CollectionEditor key={`${collection}/${id}`} collection={collection as CollectionName} id={id} />;
}

function CollectionEditor({ collection, id }: { collection: CollectionName; id: string }) {
  const ui = COLLECTION_UI[collection];
  const qc = useQueryClient();
  const can = useCan();
  const toast = useToast();
  const query = useQuery({
    queryKey: recordKey(collection, id),
    queryFn: () => api(`GET /api/v1/content/${collection}/{id}` as 'GET /api/v1/content/projects/{id}', { params: { id } }) as Promise<unknown> as Promise<RecordLike>,
    retry: false,
  });
  const record = query.data;

  const fields = useMemo(() => ui.fields.filter((f) => f.kind !== 'slug' || ui.routable), [ui]);
  const initial = useMemo<FormValues | null>(() => (record ? toForm(fields, { ...record.fields, position: record.position }) : null), [record, fields]);
  const [values, setValues] = useState<FormValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirm, setConfirm] = useState<'archive' | 'restore' | null>(null);

  useEffect(() => {
    if (initial) setValues(initial);
  }, [initial]);

  const dirty = !!values && !!initial && JSON.stringify(values) !== JSON.stringify(initial);
  const guard = useUnsavedChangesGuard(dirty && !conflict);

  const status = record?.status;
  const readOnlyReason = (f: FieldDef): string | null => {
    if (status === 'archived') return 'Запись в архиве.';
    if (!can(fieldPermission(f.name))) return fieldPermission(f.name) === 'seo.edit' ? 'Меняют роли с правом на SEO.' : 'Меняют роли с правом на редактирование контента.';
    if (f.kind === 'slug' && status !== 'draft') return 'Адрес опубликованной записи меняется вместе с перенаправлением — это появится в разделе SEO.';
    return null;
  };
  const canEditSomething = status !== 'archived' && (can('content.edit') || can('seo.edit'));

  const save = useCallback(async () => {
    if (!record || !values || !initial) return;
    const patch = buildPatch(fields, initial, values);
    const clientErrors = Object.fromEntries(Object.entries(validateAll(fields, values)).filter(([k]) => k in patch));
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) {
      toast.error(new Error('validation'), 'Проверьте выделенные поля.');
      return;
    }
    setSaving(true);
    try {
      const next = (await api(`PATCH /api/v1/content/${collection}/{id}` as 'PATCH /api/v1/content/projects/{id}', {
        params: { id },
        headers: { 'if-match': `"${record.version}"` },
        body: patch as never,
      })) as unknown as RecordLike;
      qc.setQueryData(recordKey(collection, id), next);
      void qc.invalidateQueries({ queryKey: ['content', collection, 'list'] });
      setErrors({});
      toast.success('Сохранено');
    } catch (e) {
      if (isApiError(e, 'edit_conflict')) setConflict(true);
      else {
        const fe = apiFieldErrors(e);
        setErrors(fe);
        toast.error(e, saveErrorMessage(e));
      }
    } finally {
      setSaving(false);
    }
  }, [record, values, initial, fields, collection, id, qc, toast]);

  const changeStatus = async (action: 'archive' | 'restore') => {
    if (!record) return;
    setConfirm(null);
    try {
      const next = (await api(`POST /api/v1/content/${collection}/{id}/${action}` as 'POST /api/v1/content/projects/{id}/archive', {
        params: { id },
        headers: { 'if-match': `"${record.version}"` },
      })) as unknown as RecordLike;
      qc.setQueryData(recordKey(collection, id), next);
      void qc.invalidateQueries({ queryKey: ['content', collection, 'list'] });
      toast.success(action === 'archive' ? 'Запись перенесена в архив' : 'Запись возвращена в черновики');
    } catch (e) {
      if (isApiError(e, 'edit_conflict')) setConflict(true);
      else toast.error(e);
    }
  };

  if (query.isPending || (record && !values)) return <LoadingBlock />;
  if (query.isError) {
    if (isApiError(query.error, 'not_found')) return <NotFoundPage />;
    return (
      <Alert tone="danger" action={<Button size="sm" onClick={() => void query.refetch()}>Повторить</Button>}>
        Не удалось загрузить запись.
      </Alert>
    );
  }
  if (!record || !values) return null;

  const title = String(record.fields.title ?? '') || 'Без названия';
  const sections = [...new Set(fields.map((f) => f.section))] as SectionId[];
  const set = (name: string) => (v: unknown) => {
    setValues((cur) => ({ ...cur!, [name]: v }));
    setErrors((cur) => {
      if (!(name in cur)) return cur;
      const { [name]: _, ...rest } = cur;
      return rest;
    });
  };

  return (
    <>
      <PageHeader
        title={title}
        crumbs={[{ label: 'Контент' }, { label: ui.title, to: `/content/${collection}` }, { label: title }]}
        actions={
          <>
            <StatusBadge status={record.status} />
            {record.status === 'draft' && can('content.edit') ? (
              <Button size="sm" icon={<Archive className="size-3.5" aria-hidden />} onClick={() => setConfirm('archive')} disabled={dirty}>
                В архив
              </Button>
            ) : null}
            {record.status === 'archived' && can('content.edit') ? (
              <Button size="sm" icon={<ArchiveRestore className="size-3.5" aria-hidden />} onClick={() => setConfirm('restore')}>
                Вернуть в черновики
              </Button>
            ) : null}
            <PublishButtons
              type={collection}
              id={record.id}
              status={record.status}
              version={record.version}
              dirty={dirty}
              title={title}
              onChanged={() => {
                setValues(null);
                void query.refetch();
                void qc.invalidateQueries({ queryKey: ['content', collection, 'list'] });
              }}
              onConflict={() => setConflict(true)}
              onErrors={setErrors}
            />
          </>
        }
      />
      <div className="space-y-4">
        {conflict ? (
          <ConflictAlert
            onReload={() => {
              setConflict(false);
              setValues(null);
              void query.refetch();
            }}
          />
        ) : null}
        {record.status === 'published' ? (
          <Alert tone="info">Запись отмечена к публикации. Изменения сохраняются в рабочей версии; на сайт они попадут со следующим опубликованным релизом («Публикация» → «Релизы»).</Alert>
        ) : null}
        {record.status === 'archived' ? <Alert tone="info">Запись в архиве и не редактируется. Верните её в черновики, чтобы изменить.</Alert> : null}
        {!canEditSomething && record.status !== 'archived' ? <Alert tone="info">Ваша роль может только просматривать эту запись.</Alert> : null}

        {sections.map((sid) => (
          <Card key={sid} title={SECTION_LABELS[sid].title} description={SECTION_LABELS[sid].description}>
            {record.status !== 'archived' && fields.filter((f) => f.section === sid).every((f) => !can(fieldPermission(f.name))) ? (
              <p className="mb-4 rounded-md bg-subtle px-3 py-2 text-[13px] text-ink-muted">
                {fields.some((f) => f.section === sid && fieldPermission(f.name) === 'seo.edit')
                  ? 'Эти поля меняют роли с правом на SEO (SEO-специалист, контент-менеджер, администратор).'
                  : 'Эти поля меняют роли с правом на редактирование контента.'}
              </p>
            ) : null}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {fields
                .filter((f) => f.section === sid)
                .map((f) => {
                  const reason = readOnlyReason(f);
                  const wide = !['line', 'lineNull', 'code', 'codeNull', 'position', 'enumNull', 'ref', 'slug'].includes(f.kind) || f.multiline;
                  return (
                    <div key={f.name} className={wide ? 'md:col-span-2' : undefined} data-field={f.name}>
                      <ContentField
                        def={f}
                        value={values[f.name]}
                        onChange={set(f.name)}
                        error={errors[f.name]}
                        disabled={!!reason}
                        note={reason && reason !== 'Запись в архиве.' && f.kind === 'slug' ? reason : undefined}
                      />
                      {f.kind === 'slug' && ui.pathPrefix ? (
                        <p className="mt-1 font-mono text-xs text-ink-muted">
                          {ui.pathPrefix}
                          {String(values.slug ?? '')}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
            </div>
          </Card>
        ))}

        <TranslationsCard translations={record.translations} type={collection} id={record.id} />
        <HistoryPanel
          type={collection}
          id={record.id}
          entityVersion={record.version}
          archived={record.status === 'archived'}
          onRestored={() => {
            setValues(null);
            void query.refetch();
          }}
        />
        <Advanced>
          <TechValue label="ID" value={record.id} />
          <TechValue label="Ключ" value={record.key} />
          <TechValue label="Версия" value={String(record.version)} />
          <TechValue label="Исходный язык" value={record.sourceLocale} />
          <TechValue label="Создано" value={formatDateTime(record.createdAt)} />
        </Advanced>
      </div>

      <EditorBar
        dirty={dirty}
        saving={saving}
        canSave={canEditSomething && !conflict}
        onSave={() => void save()}
        onReset={() => {
          setValues(initial);
          setErrors({});
        }}
        updatedAt={record.updatedAt}
        updatedBy={record.updatedBy}
      />
      {guard}
      <ConfirmDialog
        open={confirm === 'archive'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Перенести «${title}» в архив?`}
        consequences={[
          'Черновик исчезнет из рабочих списков (его можно найти фильтром «В архиве»).',
          'Архивную запись нельзя редактировать, пока её не вернут в черновики.',
          'На сайт это не влияет: черновики на сайте не показываются.',
        ]}
        confirmLabel="Перенести в архив"
        onConfirm={() => void changeStatus('archive')}
      />
      <ConfirmDialog
        open={confirm === 'restore'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Вернуть «${title}» в черновики?`}
        consequences={['Запись снова можно будет редактировать.', 'На сайте она не появится, пока её не опубликуют.']}
        confirmLabel="Вернуть в черновики"
        destructive={false}
        onConfirm={() => void changeStatus('restore')}
      />
    </>
  );
}
