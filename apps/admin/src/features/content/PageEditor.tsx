/**
 * Editor of a fixed page or template. The form is generated from the page slot registry
 * (@soltex/core/content PAGE_REGISTRY, review §G): labelled text slots, the page header, the texts
 * of the page's list items, its images, the legal body and the SEO data. The structure itself —
 * which slots, items and images exist — cannot be changed here (no page builder).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { PAGE_REGISTRY, type PageDef, type PageKey } from '@soltex/core/content';
import { api, isApiError } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import { useCan } from '../../lib/session';
import { useUnsavedChangesGuard } from '../../lib/unsaved';
import { Advanced, TechValue } from '../../components/ui/Advanced';
import { Alert } from '../../components/ui/Alert';
import { Card, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { NotFoundPage } from '../../app/ErrorPages';
import { MediaField, PairListField, TextField, TextListField } from './fields';
import { buildPagePatch, toPageForm, validatePage, type HeaderForm, type PageForm } from './page-form';
import { LIMITS, type FieldDef } from './model';
import { LIST_FIELD_NAMES, LIST_NAMES, PAGE_NAMES, PAGE_PATHS, slotGroup, slotLabel } from './page-labels';
import { PAGES_KEY } from './PagesListPage';
import { HistoryPanel } from '../publishing/HistoryPanel';
import { PublishButtons } from '../publishing/PublishButtons';
import { apiFieldErrors, ConflictAlert, EditorBar, saveErrorMessage, StatusBadge, TranslationsCard } from './shared';

function Section({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <Card title={title} description={description}>
      <div className="space-y-5">{children}</div>
    </Card>
  );
}

const pageKeyOf = (id: string) => ['content', 'pages', 'record', id] as const;

export function PageEditorPage() {
  const { id = '' } = useParams();
  return <PageEditor key={id} id={id} />;
}

function PageEditor({ id }: { id: string }) {
  const qc = useQueryClient();
  const can = useCan();
  const toast = useToast();
  const query = useQuery({ queryKey: pageKeyOf(id), queryFn: () => api('GET /api/v1/content/pages/{id}', { params: { id } }), retry: false });
  const record = query.data;
  const def = record ? PAGE_REGISTRY[record.pageKey as PageKey] : undefined;
  const initial = useMemo(() => (record ? toPageForm(record.fields) : null), [record]);
  const [values, setValues] = useState<PageForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  useEffect(() => {
    if (initial) setValues(initial);
  }, [initial]);
  const dirty = !!values && !!initial && JSON.stringify(values) !== JSON.stringify(initial);
  const guard = useUnsavedChangesGuard(dirty && !conflict);
  const canContent = can('content.edit');
  const canSeo = can('seo.edit');

  const save = useCallback(async () => {
    if (!record || !values || !initial || !def) return;
    const { patch, changed } = buildPagePatch(initial, values);
    // Only the parts being changed are checked: an old, untouched text never blocks a save.
    const errs = Object.fromEntries(Object.entries(validatePage(def, values)).filter(([k]) => changed.includes(k)));
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error(new Error('validation'), 'Проверьте выделенные поля.');
      return;
    }
    setSaving(true);
    try {
      const next = await api('PATCH /api/v1/content/pages/{id}', { params: { id }, headers: { 'if-match': `"${record.version}"` }, body: patch as never });
      qc.setQueryData(pageKeyOf(id), next);
      void qc.invalidateQueries({ queryKey: PAGES_KEY });
      setErrors({});
      toast.success('Сохранено');
    } catch (e) {
      if (isApiError(e, 'edit_conflict')) setConflict(true);
      else {
        setErrors(apiFieldErrors(e));
        toast.error(e, saveErrorMessage(e));
      }
    } finally {
      setSaving(false);
    }
  }, [record, values, initial, def, id, qc, toast]);

  if (query.isPending || (record && !values)) return <LoadingBlock />;
  if (query.isError) return isApiError(query.error, 'not_found') ? <NotFoundPage /> : <Alert tone="danger">Не удалось загрузить страницу.</Alert>;
  if (!record || !values || !def) return null;

  const name = PAGE_NAMES[record.pageKey as PageKey] ?? record.pageKey;
  const ro = !canContent;
  const set = (patch: Partial<PageForm>) => setValues((cur) => ({ ...cur!, ...patch }));
  const setHeader = (k: keyof HeaderForm, v: unknown) => set({ header: { ...values.header!, [k]: v } });
  const line = (n: string, label: string, kind: FieldDef['kind'], extra: Partial<FieldDef> = {}): FieldDef => ({ name: n, label, kind, section: 'content', max: kind === 'text' || kind === 'textNull' ? LIMITS.text : LIMITS.line, ...extra });

  // Slots grouped by their first word, in registry order.
  const groups: Array<{ key: string; slots: PageDef['slots'][number][] }> = [];
  for (const s of def.slots) {
    const g = slotGroup(s.key);
    const found = groups.find((x) => x.key === g);
    if (found) found.slots.push(s);
    else groups.push({ key: g, slots: [s] });
  }

  return (
    <>
      <PageHeader
        title={name}
        description={record.kind === 'template' ? 'Общие тексты, которые сайт показывает на каждой странице этого типа.' : PAGE_PATHS[record.pageKey as PageKey]}
        crumbs={[{ label: 'Контент' }, { label: 'Страницы', to: '/content/pages' }, { label: name }]}
        actions={
          <>
            <StatusBadge status={record.status} />
            <PublishButtons
              type="pages"
              id={record.id}
              status={record.status}
              version={record.version}
              dirty={dirty}
              title={name}
              onChanged={() => {
                setValues(null);
                void query.refetch();
                void qc.invalidateQueries({ queryKey: PAGES_KEY });
              }}
              onConflict={() => setConflict(true)}
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
        {record.status === 'published' ? <Alert tone="info">Страница отмечена к публикации. Изменения сохраняются в рабочей версии; на сайт они попадут со следующим опубликованным релизом («Публикация» → «Релизы»).</Alert> : null}
        {!canContent && !canSeo ? <Alert tone="info">Ваша роль может только просматривать страницы.</Alert> : null}
        {!canContent && canSeo ? <Alert tone="info">Ваша роль меняет только SEO-данные страницы (внизу). Тексты и изображения меняют роли с правом на редактирование контента.</Alert> : null}

        {values.header ? (
          <Section title="Шапка страницы">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <TextField def={line('badgeLabel', 'Метка раздела', 'line')} value={values.header.badgeLabel} disabled={ro} error={errors['header.badgeLabel']} onChange={(v) => setHeader('badgeLabel', v)} />
              <TextField def={line('badgeNumber', 'Номер раздела', 'code', { max: 10, hint: 'Например, 01. Пусто — номер не показывается.' })} value={values.header.badgeNumber} disabled={ro} onChange={(v) => setHeader('badgeNumber', v)} />
              <div className="md:col-span-2">
                <TextField def={line('title', 'Заголовок (H1)', 'line')} value={values.header.title} disabled={ro} error={errors['header.title']} onChange={(v) => setHeader('title', v)} />
              </div>
              <div className="md:col-span-2">
                <TextField def={line('subtitle', 'Подзаголовок', 'lineNull')} value={values.header.subtitle} disabled={ro} onChange={(v) => setHeader('subtitle', v)} />
              </div>
              <div className="md:col-span-2">
                <TextField def={line('description', 'Описание', 'textNull')} value={values.header.description} disabled={ro} onChange={(v) => setHeader('description', v)} />
              </div>
              <TextField def={line('actionLabel', 'Текст кнопки', 'lineNull')} value={values.header.actionLabel} disabled={ro} onChange={(v) => setHeader('actionLabel', v)} />
              <div className="md:col-span-2">
                <PairListField def={{ name: 'meta', label: 'Факты в шапке', kind: 'labelValue', section: 'content', itemLabel: 'Факт' }} value={values.header.meta} disabled={ro} error={errors['header.meta']} onChange={(v) => setHeader('meta', v)} />
              </div>
            </div>
          </Section>
        ) : null}

        {groups.length ? (
          <Section title="Тексты страницы" description="Набор текстов задан дизайном страницы. Подстановки в фигурных скобках, например {title}, заполняет сайт — их нужно сохранить.">
            {groups.map((g) => (
              <fieldset key={g.key} className="space-y-4 border-t border-line pt-4 first:border-t-0 first:pt-0">
                <legend className="mb-1 text-xs font-semibold tracking-wide text-ink-muted uppercase">{slotLabel(g.key)}</legend>
                {g.slots.map((s) => (
                  <div key={s.key} data-field={`copy.${s.key}`}>
                    <TextField
                      def={line(`copy.${s.key}`, slotLabel(s.key), s.multiline ? 'text' : 'line', {
                        hint: s.placeholders.length ? `Сохраните ${s.placeholders.map((p) => `{${p}}`).join(', ')}.` : undefined,
                      })}
                      value={values.copy[s.key] ?? ''}
                      disabled={ro}
                      error={errors[`copy.${s.key}`]}
                      onChange={(v) => set({ copy: { ...values.copy, [s.key]: v } })}
                    />
                  </div>
                ))}
              </fieldset>
            ))}
          </Section>
        ) : null}

        {Object.entries(values.lists).map(([listKey, items]) => (
          <Section key={listKey} title={LIST_NAMES[listKey] ?? slotLabel(listKey)} description="Количество и порядок элементов заданы страницей; меняются тексты.">
            {errors[`lists.${listKey}`] ? <p className="text-xs font-medium text-danger">{errors[`lists.${listKey}`]}</p> : null}
            <ol className="space-y-3">
              {items.map((item, i) => (
                <li key={i} className="space-y-3 rounded-md border border-line p-3">
                  <p className="text-xs font-semibold text-ink-muted">Элемент {i + 1}</p>
                  {Object.entries(item).map(([field, text]) => (
                    <TextField
                      key={field}
                      def={line(`${listKey}.${i}.${field}`, LIST_FIELD_NAMES[field] ?? slotLabel(field), field === 'description' ? 'text' : 'line')}
                      value={text}
                      disabled={ro}
                      onChange={(v) => set({ lists: { ...values.lists, [listKey]: items.map((x, j) => (j === i ? { ...x, [field]: v } : x)) } })}
                    />
                  ))}
                </li>
              ))}
            </ol>
          </Section>
        ))}

        {def.media.length ? (
          <Section title="Изображения">
            {def.media.map((slot) => (
              <MediaField
                key={slot}
                def={{ name: `media.${slot}`, label: slotLabel(slot), kind: 'media', section: 'relations', mediaKind: 'image' }}
                value={values.media[slot] ?? ''}
                disabled={ro}
                error={errors[`media.${slot}`]}
                onChange={(v) => set({ media: { ...values.media, [slot]: v } })}
              />
            ))}
          </Section>
        ) : null}

        {def.body ? (
          <Section title="Текст документа" description="Абзацы юридического текста. Пока текст не подготовлен, страница остаётся черновиком.">
            <TextListField def={{ name: 'body', label: 'Абзацы', kind: 'listNull', section: 'content', itemLabel: 'Абзац' }} value={values.body} disabled={ro} error={errors.body} onChange={(v) => set({ body: v })} />
          </Section>
        ) : null}

        {def.seo ? (
          <Section title="SEO" description="Пустые поля — сайт использует шаблон по умолчанию.">
            {!canSeo ? <p className="rounded-md bg-subtle px-3 py-2 text-[13px] text-ink-muted">Эти поля меняют роли с правом на SEO.</p> : null}
            <TextField def={line('seoMetaTitle', 'SEO-заголовок (title)', 'lineNull', { max: 200, hint: 'Рекомендуется до 60 символов.' })} value={values.seoMetaTitle} disabled={!canSeo} error={errors.seoMetaTitle} onChange={(v) => set({ seoMetaTitle: v })} />
            <TextField def={line('seoMetaDescription', 'Мета-описание (description)', 'textNull', { max: 400, hint: 'Рекомендуется 70–160 символов.' })} value={values.seoMetaDescription} disabled={!canSeo} error={errors.seoMetaDescription} onChange={(v) => set({ seoMetaDescription: v })} />
            <MediaField def={{ name: 'ogImage', label: 'Изображение для соцсетей (OG)', kind: 'mediaNull', section: 'seo', mediaKind: 'image' }} value={values.ogImage} disabled={!canSeo} error={errors.ogImage} onChange={(v) => set({ ogImage: v })} />
            <label className="flex items-start gap-2 text-[13px]">
              <input type="checkbox" className="mt-0.5 size-4 accent-accent" checked={values.noindex} disabled={!canSeo} onChange={(e) => set({ noindex: e.target.checked })} />
              <span>
                <span className="font-medium">Не индексировать (noindex)</span>
                <span className="block text-xs text-ink-muted">Страница не попадёт в поисковики и в sitemap.</span>
              </span>
            </label>
          </Section>
        ) : null}

        <TranslationsCard translations={record.translations} type="pages" id={record.id} />
        <HistoryPanel
          type="pages"
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
          <TechValue label="Ключ" value={`${record.key} (${record.pageKey})`} />
          <TechValue label="Версия" value={String(record.version)} />
          <TechValue label="Создано" value={formatDateTime(record.createdAt)} />
        </Advanced>
      </div>
      <EditorBar
        dirty={dirty}
        saving={saving}
        canSave={(canContent || canSeo) && !conflict}
        onSave={() => void save()}
        onReset={() => {
          setValues(initial);
          setErrors({});
        }}
        updatedAt={record.updatedAt}
        updatedBy={record.updatedBy}
      />
      {guard}
      {Object.keys(errors).length ? <span className="sr-only" role="alert">Проверьте выделенные поля</span> : null}
    </>
  );
}
