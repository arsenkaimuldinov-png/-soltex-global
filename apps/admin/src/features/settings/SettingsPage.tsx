/**
 * Настройки сайта (Phase N-0, docs/admin-settings.md): контакты, головной офис, подвал, SEO по
 * умолчанию, цифры на главной и региональные офисы — во всех шести языках на одном экране.
 * Записи только редактируются (не создаются и не удаляются: под них сделана вёрстка сайта).
 * Сохранение требует свежего второго фактора; изменения попадают на сайт со следующей публикацией.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, isApiError } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import { useStepUp } from '../../lib/step-up';
import { useUnsavedChangesGuard } from '../../lib/unsaved';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Card, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { cx } from '../../components/ui/cx';
import { errorsByPath, isDirty, LOCALE_TABS, LOCALES, toBody, toForm, translationsToCheck, type Loc, type SettingsForm } from './model';

const KEY = ['settings'];
const textarea =
  'block w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink transition-colors focus:border-accent focus:outline-none disabled:bg-subtle disabled:text-ink-muted';

const TEXT_LABELS: Record<string, { label: string; multiline?: boolean; hint?: string }> = {
  hqName: { label: 'Название компании' },
  hqAddressLine1: { label: 'Адрес, строка 1' },
  hqAddressLine2: { label: 'Адрес, строка 2' },
  hqShortAddress: { label: 'Короткий адрес', hint: 'Показывается там, где мало места.' },
  hqJurisdiction: { label: 'Юрисдикция' },
  hqHours: { label: 'Часы работы' },
  footerTagline: { label: 'Описание в подвале', multiline: true },
  footerLocation: { label: 'Местоположение в подвале' },
  copyright: { label: 'Копирайт' },
  defaultSiteTitle: { label: 'Заголовок сайта по умолчанию', hint: 'Для страниц без своего SEO-заголовка.' },
  defaultSiteDescription: { label: 'Описание сайта по умолчанию', multiline: true, hint: 'Для страниц без своего SEO-описания.' },
};

export function SettingsPage() {
  const q = useQuery({ queryKey: KEY, queryFn: () => api('GET /api/v1/settings') });
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <Alert tone="danger" title="Не удалось загрузить настройки">Обновите страницу.</Alert>;
  return <SettingsEditor key={q.data.version} data={q.data} />;
}

function SettingsEditor({ data }: { data: Parameters<typeof toForm>[0] }) {
  const qc = useQueryClient();
  const toast = useToast();
  const withStepUp = useStepUp();
  const initial = useMemo(() => toForm(data), [data]);
  const [form, setForm] = useState<SettingsForm>(initial);
  const [loc, setLoc] = useState<Loc>('en');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ fields: Record<string, string>; locales: Set<Loc> }>({ fields: {}, locales: new Set() });
  const [conflict, setConflict] = useState(false);
  const dirty = isDirty(initial, form);
  const guard = useUnsavedChangesGuard(dirty && !saving);
  const toCheck = translationsToCheck(initial, form);

  const edit = (f: (draft: SettingsForm) => void) =>
    setForm((prev) => {
      const next = structuredClone(prev);
      f(next);
      return next;
    });
  const err = (path: string, withLoc = false) => errors.fields[withLoc ? `${path}@${loc}` : path];
  const rtl = loc === 'ar' ? 'rtl' : undefined;

  async function save() {
    setSaving(true);
    setErrors({ fields: {}, locales: new Set() });
    setConflict(false);
    try {
      const saved = await withStepUp(() => api('PUT /api/v1/settings', { headers: { 'if-match': `"${data.version}"` }, body: toBody(form) }));
      qc.setQueryData(KEY, saved);
      toast.success(saved.version === data.version ? 'Изменений нет' : 'Настройки сохранены. Они появятся на сайте после следующей публикации.');
    } catch (e) {
      if (isApiError(e, 'edit_conflict')) setConflict(true);
      else if (isApiError(e, 'validation_failed')) {
        const found = errorsByPath(e.fieldErrors);
        setErrors(found);
        toast.error(e, 'Проверьте отмеченные поля.');
      } else toast.error(e);
    } finally {
      setSaving(false);
    }
  }

  const text = (path: string, value: string, onChange: (v: string) => void, opts: { label: string; multiline?: boolean; hint?: ReactNode; optional?: boolean }) => (
    <Field key={`${path}@${loc}`} label={opts.optional ? `${opts.label} (необязательно)` : opts.label} hint={opts.hint} error={err(path, true)}>
      {({ id, describedBy, invalid }) =>
        opts.multiline ? (
          <textarea id={id} dir={rtl} aria-describedby={describedBy} aria-invalid={invalid || undefined} rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={cx(textarea, invalid ? 'border-danger' : 'border-line-strong')} />
        ) : (
          <Input id={id} dir={rtl} aria-describedby={describedBy} invalid={invalid} value={value} onChange={(e) => onChange(e.target.value)} />
        )
      }
    </Field>
  );
  const plain = (path: string, label: string, value: string, onChange: (v: string) => void, opts: { type?: string; optional?: boolean; hint?: ReactNode } = {}) => (
    <Field label={opts.optional ? `${label} (необязательно)` : label} hint={opts.hint} error={err(path)}>
      {({ id, describedBy, invalid }) => <Input id={id} type={opts.type} dir="ltr" aria-describedby={describedBy} invalid={invalid} value={value} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
  const settingsText = (k: keyof SettingsForm['texts'][Loc]) =>
    text(`texts.${k}`, form.texts[loc][k], (v) => edit((d) => void (d.texts[loc][k] = v)), TEXT_LABELS[k]!);

  return (
    <>
      <PageHeader
        title="Настройки сайта"
        description="Контакты, офисы, цифры на главной и тексты подвала. Изменения появятся на сайте после следующей публикации."
        crumbs={[{ label: 'Администрирование' }, { label: 'Настройки сайта' }]}
        actions={
          <Button variant="primary" loading={saving} disabled={!dirty} onClick={() => void save()}>
            Сохранить
          </Button>
        }
      />
      {conflict ? (
        <Alert tone="danger" title="Настройки уже изменил другой пользователь" className="mb-4" action={<Button size="sm" onClick={() => void qc.invalidateQueries({ queryKey: KEY })}>Загрузить заново</Button>}>
          Ваши правки не сохранены. Загрузите актуальную версию и повторите их.
        </Alert>
      ) : null}
      <p className="mb-4 text-xs text-ink-muted">
        {data.updatedBy ? `Последнее изменение: ${formatDateTime(data.updatedAt)}, ${data.updatedBy.name}.` : null} Логотипы и фон подвала меняет разработчик. Опубликовать изменения:{' '}
        <Link to="/publishing" className="text-accent underline">Публикация</Link>.
      </p>

      <Card title="Контакты" description="Адреса одинаковы во всех языках.">
        <div className="grid gap-4 md:grid-cols-2">
          {plain('primaryEmail', 'Основной e-mail сайта', form.primaryEmail, (v) => edit((d) => void (d.primaryEmail = v)), { type: 'email' })}
          {plain('hqEmail', 'E-mail головного офиса', form.hqEmail, (v) => edit((d) => void (d.hqEmail = v)), { type: 'email' })}
        </div>
      </Card>

      <div role="tablist" aria-label="Язык текстов" className="sticky top-0 z-10 my-4 flex flex-wrap gap-1 border-b border-line bg-canvas py-2">
        {LOCALES.map((l) => {
          const check = l !== 'en' ? toCheck[l].length : 0;
          return (
            <button
              key={l}
              role="tab"
              type="button"
              aria-selected={loc === l}
              onClick={() => setLoc(l)}
              className={cx('rounded-md px-3 py-1.5 text-sm', loc === l ? 'bg-accent text-white' : 'text-ink hover:bg-subtle', errors.locales.has(l) && loc !== l && 'ring-1 ring-danger')}
            >
              {LOCALE_TABS[l]}
              {check ? <span className="ml-1.5 rounded bg-warn-soft px-1 text-[11px] text-warn" title="Английский текст изменён — проверьте перевод">{check}</span> : null}
            </button>
          );
        })}
      </div>
      {loc !== 'en' && toCheck[loc].length ? (
        <Alert tone="warn" className="mb-4">
          Английский текст изменён в {toCheck[loc].length} {toCheck[loc].length === 1 ? 'поле' : 'полях'}, а здесь — нет. Проверьте перевод: после сохранения он считается актуальным.
        </Alert>
      ) : null}

      <div className="space-y-4">
        <Card title="Головной офис">
          <div className="grid gap-4 md:grid-cols-2">
            {(['hqName', 'hqAddressLine1', 'hqAddressLine2', 'hqShortAddress', 'hqJurisdiction', 'hqHours'] as const).map(settingsText)}
          </div>
        </Card>
        <Card title="Подвал сайта">
          <div className="grid gap-4">{(['footerTagline', 'footerLocation', 'copyright'] as const).map(settingsText)}</div>
        </Card>
        <Card title="SEO по умолчанию">
          <div className="grid gap-4">{(['defaultSiteTitle', 'defaultSiteDescription'] as const).map(settingsText)}</div>
        </Card>
        <Card title="Цифры на главной" description="Подпись может содержать перенос строки и вставку {highlight} — на её место встанет выделенный текст.">
          <div className="grid gap-6">
            {form.metrics.map((m, i) => (
              <div key={m.id} className="grid gap-4 border-b border-line pb-4 last:border-0 md:grid-cols-[10rem_1fr_1fr]">
                {plain(`metrics.${i}.value`, 'Значение', m.value, (v) => edit((d) => void (d.metrics[i]!.value = v)), { optional: true, hint: 'Например, 25+' })}
                {text(`metrics.${i}.texts.label`, m.texts[loc].label, (v) => edit((d) => void (d.metrics[i]!.texts[loc].label = v)), { label: 'Подпись', multiline: true })}
                {text(`metrics.${i}.texts.highlight`, m.texts[loc].highlight, (v) => edit((d) => void (d.metrics[i]!.texts[loc].highlight = v)), { label: 'Выделенный текст', optional: true })}
              </div>
            ))}
          </div>
        </Card>
        <Card title="Региональные офисы" description="Список офисов на сайте. Новый офис добавляет разработчик.">
          <div className="grid gap-6">
            {form.offices.map((o, i) => (
              <fieldset key={o.id} className="grid gap-4 border-b border-line pb-6 last:border-0 md:grid-cols-2">
                <legend className="mb-2 text-sm font-semibold text-ink">
                  {o.texts.en.region} · {o.texts.en.country}
                </legend>
                {text(`offices.${i}.texts.region`, o.texts[loc].region, (v) => edit((d) => void (d.offices[i]!.texts[loc].region = v)), { label: 'Регион (заголовок карточки)' })}
                {text(`offices.${i}.texts.title`, o.texts[loc].title, (v) => edit((d) => void (d.offices[i]!.texts[loc].title = v)), { label: 'Юрлицо' })}
                {text(`offices.${i}.texts.country`, o.texts[loc].country, (v) => edit((d) => void (d.offices[i]!.texts[loc].country = v)), { label: 'Страна, город' })}
                {text(`offices.${i}.texts.address`, o.texts[loc].address, (v) => edit((d) => void (d.offices[i]!.texts[loc].address = v)), { label: 'Адрес', optional: true })}
                {text(`offices.${i}.texts.representative`, o.texts[loc].representative, (v) => edit((d) => void (d.offices[i]!.texts[loc].representative = v)), { label: 'Представитель', optional: true })}
                {plain(`offices.${i}.email`, 'E-mail', o.email, (v) => edit((d) => void (d.offices[i]!.email = v)), { type: 'email' })}
                {plain(`offices.${i}.phone`, 'Телефон', o.phone, (v) => edit((d) => void (d.offices[i]!.phone = v)), { type: 'tel', optional: true })}
                {plain(`offices.${i}.whatsapp`, 'WhatsApp', o.whatsapp, (v) => edit((d) => void (d.offices[i]!.whatsapp = v)), { optional: true, hint: 'Номер в международном формате' })}
              </fieldset>
            ))}
          </div>
        </Card>
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="primary" loading={saving} disabled={!dirty} onClick={() => void save()}>
          Сохранить
        </Button>
      </div>
      {guard}
    </>
  );
}
