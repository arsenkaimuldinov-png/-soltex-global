/**
 * Translation editor (review §H): the English source and the target language side by side, field by
 * field. Only the target language is edited; the structure (fields, list items) is that of the
 * source. Saving makes the translation «В работе»; a reviewer (content.publish) approves it or
 * returns it to work. Arabic is edited right-to-left (dir="rtl" on the target inputs only).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Copy } from 'lucide-react';
import { TRANSLATED_LOCALES, type TranslatedLocale } from '@soltex/core/domain';
import { api, isApiError } from '../../lib/api/client';
import { formatDate, formatDateTime } from '../../lib/format';
import { useCan } from '../../lib/session';
import { useUnsavedChangesGuard } from '../../lib/unsaved';
import { Advanced, TechValue } from '../../components/ui/Advanced';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Card, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { Status } from '../../components/ui/Status';
import { useToast } from '../../components/ui/Toast';
import { cx } from '../../components/ui/cx';
import { NotFoundPage } from '../../app/ErrorPages';
import { ConflictAlert, EditorBar, saveErrorMessage } from '../content/shared';
import {
  changedTranslationFields,
  contentPath,
  fieldLabel,
  itemFieldLabel,
  LOCALE_INFO,
  REVIEW_PERMISSION,
  sameAsSource,
  setPart,
  STATE_HINTS,
  STATE_LABELS,
  STATE_TONES,
  toTranslationForm,
  TRANSLATABLE_TYPES,
  TRANSLATION_ERROR_LABELS,
  translationFieldPermission,
  translationPath,
  TYPE_LABELS,
  validateTranslationField,
  type TranslatableType,
  type TranslationFieldView,
  type TranslationForm,
  type Value,
} from './model';
import { OVERVIEW_KEY } from './TranslationsOverviewPage';

const keyOf = (type: string, id: string, locale: string) => ['translations', 'record', type, id, locale] as const;
// The seven types share one contract; the projects operation stands for all of them in the types.
const getOp = (type: TranslatableType) => `GET /api/v1/content/${type}/{id}/translations/{locale}` as 'GET /api/v1/content/projects/{id}/translations/{locale}';
const patchOp = (type: TranslatableType) => `PATCH /api/v1/content/${type}/{id}/translations/{locale}` as 'PATCH /api/v1/content/projects/{id}/translations/{locale}';

export function TranslationEditorPage() {
  const { type = '', id = '', locale = '' } = useParams();
  if (!(TRANSLATABLE_TYPES as readonly string[]).includes(type) || !(TRANSLATED_LOCALES as readonly string[]).includes(locale)) return <NotFoundPage />;
  return <TranslationEditor key={`${type}/${id}/${locale}`} type={type as TranslatableType} id={id} locale={locale as TranslatedLocale} />;
}

function TranslationEditor({ type, id, locale }: { type: TranslatableType; id: string; locale: TranslatedLocale }) {
  const qc = useQueryClient();
  const can = useCan();
  const toast = useToast();
  const query = useQuery({ queryKey: keyOf(type, id, locale), queryFn: () => api(getOp(type), { params: { id, locale } }), retry: false });
  const rec = query.data;
  const fields = (rec?.fields ?? []) as TranslationFieldView[];
  const initial = useMemo(() => (rec ? toTranslationForm(rec.fields as TranslationFieldView[]) : null), [rec]);
  const [values, setValues] = useState<TranslationForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | 'save' | 'approve' | 'reopen'>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  useEffect(() => {
    if (initial) setValues(initial);
  }, [initial]);
  const changed = values && initial ? changedTranslationFields(initial, values) : [];
  const dirty = changed.length > 0;
  const guard = useUnsavedChangesGuard(dirty && !conflict);

  const after = useCallback(
    (next: typeof rec) => {
      qc.setQueryData(keyOf(type, id, locale), next);
      void qc.invalidateQueries({ queryKey: OVERVIEW_KEY });
      void qc.invalidateQueries({ queryKey: ['translations', 'list'] });
      void qc.invalidateQueries({ queryKey: ['content'] });
    },
    [qc, type, id, locale]
  );

  const fail = useCallback(
    (e: unknown) => {
      if (isApiError(e, 'edit_conflict')) setConflict(true);
      else {
        if (isApiError(e)) setErrors(Object.fromEntries(e.fieldErrors.map((f) => [f.field, TRANSLATION_ERROR_LABELS[f.message] ?? f.message])));
        toast.error(e, saveErrorMessage(e));
      }
    },
    [toast]
  );

  const save = useCallback(async () => {
    if (!rec || !values || !initial) return;
    const names = changedTranslationFields(initial, values);
    const errs: Record<string, string> = {};
    for (const n of names) {
      const f = fields.find((x) => x.name === n)!;
      const code = validateTranslationField(f, values[n]!);
      if (code) errs[n] = TRANSLATION_ERROR_LABELS[code]!;
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error(new Error('validation'), 'Проверьте выделенные поля.');
      return;
    }
    setBusy('save');
    try {
      const next = await api(patchOp(type), {
        params: { id, locale },
        headers: { 'if-match': rec.etag },
        body: { fields: Object.fromEntries(names.map((n) => [n, values[n]])) } as never,
      });
      after(next);
      setErrors({});
      toast.success('Перевод сохранён');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }, [rec, values, initial, fields, type, id, locale, after, fail, toast]);

  const reviewAction = useCallback(
    async (action: 'approve' | 'reopen') => {
      if (!rec) return;
      setBusy(action);
      try {
        const next = await api(`POST /api/v1/content/${type}/{id}/translations/{locale}/${action}` as 'POST /api/v1/content/projects/{id}/translations/{locale}/approve', {
          params: { id, locale },
          headers: { 'if-match': rec.etag },
        });
        after(next);
        toast.success(action === 'approve' ? 'Перевод утверждён' : 'Перевод возвращён в работу');
      } catch (e) {
        fail(e);
      } finally {
        setBusy(null);
        setConfirmReopen(false);
      }
    },
    [rec, type, id, locale, after, fail, toast]
  );

  if (query.isPending || (rec && !values)) return <LoadingBlock />;
  if (query.isError) return isApiError(query.error, 'not_found') ? <NotFoundPage /> : <Alert tone="danger">Не удалось загрузить перевод.</Alert>;
  if (!rec || !values) return null;

  const info = LOCALE_INFO[locale];
  const canReview = can(REVIEW_PERMISSION);
  const canAnyEdit = can('content.edit') || can('seo.edit');
  const editable = rec.editable && canAnyEdit && !conflict;
  const contentFields = fields.filter((f) => f.group === 'content');
  const seoFields = fields.filter((f) => f.group === 'seo');
  const set = (name: string, v: Value) => setValues((cur) => ({ ...cur!, [name]: v }));

  const renderField = (f: TranslationFieldView) => {
    const allowed = editable && can(translationFieldPermission(f.name));
    const same = rec.state !== 'missing' && sameAsSource(f, values[f.name]!);
    return (
      <TranslationFieldRow
        key={f.name}
        field={f}
        label={fieldLabel(type, f.name)}
        value={values[f.name]!}
        onChange={(v) => set(f.name, v)}
        disabled={!allowed}
        error={errors[f.name]}
        locale={locale}
        note={
          !allowed && editable ? 'Это поле меняют роли с другим правом.' : same ? 'Совпадает с английским текстом — проверьте, нужен ли перевод.' : undefined
        }
      />
    );
  };

  return (
    <>
      <PageHeader
        title={rec.title}
        description={`${TYPE_LABELS[type]} · перевод на ${info.name.toLowerCase()} язык`}
        crumbs={[{ label: 'Переводы', to: '/translations' }, { label: TYPE_LABELS[type], to: `/translations/all?type=${type}` }, { label: rec.title }]}
        actions={<Status tone={STATE_TONES[rec.state]}>{STATE_LABELS[rec.state]}</Status>}
      />
      <nav aria-label="Языки" className="mb-4 flex flex-wrap gap-2">
        <Link to={contentPath(type, id)} className="rounded-md border border-line px-2.5 py-1.5 text-[13px] text-ink-muted hover:bg-subtle" title="Исходный текст редактируется в разделе «Контент»">
          <span className="font-mono text-xs font-semibold">EN</span> Исходный текст
        </Link>
        {TRANSLATED_LOCALES.map((l) => (
          <Link
            key={l}
            to={translationPath(type, id, l)}
            aria-current={l === locale ? 'page' : undefined}
            className={cx('rounded-md border px-2.5 py-1.5 text-[13px]', l === locale ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-line hover:bg-subtle')}
          >
            <span className="font-mono text-xs font-semibold">{LOCALE_INFO[l].short}</span> {LOCALE_INFO[l].name}
          </Link>
        ))}
      </nav>

      <div className="space-y-4">
        {conflict ? (
          <ConflictAlert
            onReload={() => {
              setConflict(false);
              setValues(null);
              setErrors({});
              void query.refetch();
            }}
          />
        ) : null}
        <Alert tone={rec.state === 'outdated' ? 'warn' : rec.state === 'approved' ? 'ok' : 'info'} title={STATE_LABELS[rec.state]}>
          {STATE_HINTS[rec.state]}
          {rec.state === 'outdated' && rec.approvedAt ? ` Утверждён ${formatDate(rec.approvedAt)}${rec.approvedBy ? ` (${rec.approvedBy.name})` : ''}.` : null}
          {rec.state === 'approved' && rec.approvedAt ? ` Утверждён ${formatDate(rec.approvedAt)}${rec.approvedBy ? ` (${rec.approvedBy.name})` : ''}.` : null}
        </Alert>
        {rec.sourceChangedSinceEdit ? <Alert tone="warn">Английский текст изменился после последнего сохранения перевода. Сверьте перевод с текущим исходным текстом.</Alert> : null}
        {!rec.editable ? <Alert tone="info">Материал в архиве: его переводы доступны только для чтения.</Alert> : null}
        {rec.editable && !canAnyEdit ? <Alert tone="info">Ваша роль может только просматривать переводы.</Alert> : null}
        {rec.editable && canAnyEdit && !can('content.edit') ? <Alert tone="info">Ваша роль переводит только SEO-тексты (внизу).</Alert> : null}
        {rec.sameAsSource.length && rec.state !== 'missing' ? (
          <p className="text-[13px] text-ink-muted">Полей, совпадающих с английским текстом: {rec.sameAsSource.length}. Названия и коды могут не переводиться — проверьте остальные.</p>
        ) : null}

        {!fields.length ? <Alert tone="info">У этого материала пока нет текстов для перевода.</Alert> : null}
        {contentFields.length ? (
          <Card title="Тексты" description={`Слева — английский исходный текст, справа — перевод (${info.name.toLowerCase()}). Структура списков задана исходным текстом.`}>
            <div className="space-y-6">{contentFields.map(renderField)}</div>
          </Card>
        ) : null}
        {seoFields.length ? (
          <Card title="SEO" description="Переводы SEO-текстов меняют роли с правом на SEO.">
            <div className="space-y-6">{seoFields.map(renderField)}</div>
          </Card>
        ) : null}

        <Advanced>
          <TechValue label="ID" value={rec.id} />
          <TechValue label="Ключ" value={rec.key} />
          <TechValue label="Версия исходного текста" value={String(rec.sourceRevision)} />
          <TechValue label="Утверждён для версии" value={rec.approvedSourceRevision === null ? '—' : String(rec.approvedSourceRevision)} />
          <TechValue label="ETag" value={rec.etag} />
        </Advanced>
      </div>

      <EditorBar
        dirty={dirty}
        saving={busy === 'save'}
        canSave={editable}
        onSave={() => void save()}
        onReset={() => {
          setValues(initial);
          setErrors({});
        }}
        updatedAt={rec.updatedAt}
        updatedBy={rec.updatedBy}
        extra={
          canReview && rec.editable && !conflict ? (
            <>
              {rec.state === 'approved' || rec.state === 'outdated' ? (
                <Button onClick={() => setConfirmReopen(true)} disabled={dirty || !!busy}>
                  Вернуть в работу
                </Button>
              ) : null}
              {rec.state === 'in_progress' || rec.state === 'outdated' ? (
                <Button
                  variant={dirty ? 'secondary' : 'primary'}
                  onClick={() => void reviewAction('approve')}
                  loading={busy === 'approve'}
                  disabled={dirty || (!!busy && busy !== 'approve')}
                  title={dirty ? 'Сначала сохраните изменения' : undefined}
                >
                  Утвердить перевод
                </Button>
              ) : null}
            </>
          ) : null
        }
      />
      <ConfirmDialog
        open={confirmReopen}
        onOpenChange={setConfirmReopen}
        title="Вернуть перевод в работу?"
        consequences={[
          `Перевод (${info.name.toLowerCase()}) перестанет считаться утверждённым.`,
          'Пока его не утвердят снова, сайт для этого языка покажет английский текст этого материала (после следующей публикации сайта).',
          'Тексты перевода не меняются.',
        ]}
        confirmLabel="Вернуть в работу"
        onConfirm={() => void reviewAction('reopen')}
        busy={busy === 'reopen'}
        destructive={false}
      />
      {guard}
      {Object.keys(errors).length ? <span className="sr-only" role="alert">Проверьте выделенные поля</span> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// One field: source (read-only) | target (edited)
// ---------------------------------------------------------------------------

const input =
  'block w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink transition-colors focus:border-accent focus:outline-none disabled:bg-subtle disabled:text-ink-muted';

function SourceText({ children }: { children: ReactNode }) {
  return (
    <div lang="en" dir="ltr" className="rounded-md border border-line bg-subtle px-3 py-2 text-sm whitespace-pre-wrap text-ink">
      {children}
    </div>
  );
}

function TargetText({
  value,
  onChange,
  multiline,
  disabled,
  locale,
  label,
  invalid,
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  multiline: boolean;
  disabled: boolean;
  locale: TranslatedLocale;
  label: string;
  invalid: boolean;
  max?: number;
}) {
  const { lang, dir } = LOCALE_INFO[locale];
  const common = {
    'aria-label': label,
    'aria-invalid': invalid || undefined,
    lang,
    dir,
    disabled,
    value,
    className: cx(input, invalid ? 'border-danger' : 'border-line-strong'),
  };
  return (
    <div className="space-y-1">
      {multiline ? <textarea {...common} rows={Math.min(8, Math.max(2, Math.ceil(value.length / 70)))} onChange={(e) => onChange(e.target.value)} /> : <input {...common} onChange={(e) => onChange(e.target.value)} />}
      {max ? (
        <p className={cx('text-right text-xs tabular-nums', value.trim().length > max ? 'font-medium text-danger' : 'text-ink-faint')} aria-live="polite">
          {value.trim().length} / {max}
        </p>
      ) : null}
    </div>
  );
}

/** Text parts of a value with labels, flattened for side-by-side rows. */
function parts(f: TranslationFieldView, value: Value): Array<{ path: string; label: string; text: string; multiline: boolean }> {
  switch (f.kind) {
    case 'text':
      return [{ path: '', label: '', text: value as string, multiline: f.multiline }];
    case 'list':
      return (value as string[]).map((t, i) => ({ path: `${i}`, label: `Пункт ${i + 1}`, text: t, multiline: true }));
    case 'pairs':
      return (value as Array<{ label: string; value: string }>).flatMap((p, i) => [
        { path: `${i}.label`, label: `${i + 1} · подпись`, text: p.label, multiline: false },
        { path: `${i}.value`, label: `${i + 1} · значение`, text: p.value, multiline: false },
      ]);
    case 'titleDesc':
      return (value as Array<{ title: string; description: string }>).flatMap((p, i) => [
        { path: `${i}.title`, label: `${i + 1} · заголовок`, text: p.title, multiline: false },
        { path: `${i}.description`, label: `${i + 1} · описание`, text: p.description, multiline: true },
      ]);
    case 'patentInfo': {
      const p = value as { patentNumber: string; location: string; keyPoints: string[] };
      return [
        { path: 'patentNumber', label: 'Номер патента', text: p.patentNumber, multiline: false },
        { path: 'location', label: 'Место', text: p.location, multiline: false },
        ...p.keyPoints.map((k, i) => ({ path: `keyPoints.${i}`, label: `Ключевой пункт ${i + 1}`, text: k, multiline: true })),
      ];
    }
    case 'records':
      return (value as Array<Record<string, string>>).flatMap((r, i) =>
        Object.entries(r).map(([k, t]) => ({ path: `${i}.${k}`, label: `Элемент ${i + 1} · ${itemFieldLabel(k)}`, text: t, multiline: k === 'description' }))
      );
  }
}

function TranslationFieldRow({
  field,
  label,
  value,
  onChange,
  disabled,
  error,
  locale,
  note,
}: {
  field: TranslationFieldView;
  label: string;
  value: Value;
  onChange: (v: Value) => void;
  disabled: boolean;
  error?: string;
  locale: TranslatedLocale;
  note?: string;
}) {
  const src = parts(field, field.source);
  const tgt = parts(field, value);
  return (
    <section className="space-y-2 border-t border-line pt-5 first:border-t-0 first:pt-0" data-field={field.name} aria-label={label}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-ink">{label}</h3>
        {!disabled ? (
          <Button size="sm" variant="ghost" icon={<Copy className="size-3.5" aria-hidden />} onClick={() => onChange(JSON.parse(JSON.stringify(field.source)) as Value)}>
            Скопировать исходный
          </Button>
        ) : null}
      </div>
      {field.placeholders.length ? <p className="text-xs text-ink-muted">Сохраните подстановки: {field.placeholders.map((p) => `{${p}}`).join(', ')}.</p> : null}
      <div className="space-y-3">
        {tgt.map((t, i) => (
          <div key={t.path} className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-4">
            <div className="min-w-0 space-y-1">
              {t.label ? <p className="text-xs text-ink-muted">{t.label} · EN</p> : <p className="text-xs text-ink-muted md:hidden">Английский</p>}
              <SourceText>{src[i]?.text}</SourceText>
            </div>
            <div className="min-w-0 space-y-1">
              {t.label ? <p className="text-xs text-ink-muted">{t.label} · {LOCALE_INFO[locale].short}</p> : <p className="text-xs text-ink-muted md:hidden">Перевод</p>}
              <TargetText
                value={t.text}
                onChange={(text) => onChange(setPart(field.kind, value, t.path, text))}
                multiline={t.multiline}
                disabled={disabled}
                locale={locale}
                label={`${label}${t.label ? `, ${t.label}` : ''} — перевод`}
                invalid={!!error}
                max={field.kind === 'text' ? field.max : undefined}
              />
            </div>
          </div>
        ))}
      </div>
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : note ? <p className="text-xs text-ink-muted">{note}</p> : null}
    </section>
  );
}
