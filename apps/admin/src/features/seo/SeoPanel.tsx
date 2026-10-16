/**
 * «Проверка SEO» in the content editors (Phase I-1): the search-result snippet the site produces
 * for each language (title / URL / description, with the default template when no SEO text is set),
 * character counters and the record's checks (✗ error, ⚠ warning, ℹ hint) with «Перейти к полю».
 * The data comes from GET /content/{type}/{id}/seo — the same checker the build and publishing use.
 * A draft is checked as if it were published.
 */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AlertTriangle, CircleX, Info } from 'lucide-react';
import { CONTENT_LOCALES, type Locale } from '@soltex/core/domain';
import { SEO_DESCRIPTION_RECOMMENDED_MAX, SEO_DESCRIPTION_RECOMMENDED_MIN, SEO_TITLE_RECOMMENDED_MAX } from '@soltex/core/seo';
import { api } from '../../lib/api/client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { Card } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { LOCALE_INFO, type TranslatableType } from '../translations/model';
import { describeSeoIssue, focusField, snippetDescription, snippetTitle, snippetUrl, sortIssues, type SeoIssueView } from './model';

export const seoRecordKey = (type: string, id: string) => ['seo', 'record', type, id] as const;

/** The record's SEO report; refreshed whenever the record's version changes (after every save). */
export function useRecordSeo(type: TranslatableType, id: string, version: number) {
  return useQuery({
    queryKey: [...seoRecordKey(type, id), version],
    queryFn: () => api(`GET /api/v1/content/${type}/{id}/seo` as 'GET /api/v1/content/projects/{id}/seo', { params: { id } }),
  });
}

const ICON = {
  blocking: <CircleX className="size-4 shrink-0 text-danger" aria-hidden />,
  warning: <AlertTriangle className="size-4 shrink-0 text-warn" aria-hidden />,
  info: <Info className="size-4 shrink-0 text-ink-faint" aria-hidden />,
};
const SR = { blocking: 'Ошибка: ', warning: 'Предупреждение: ', info: 'Подсказка: ' };

export function SeoPanel({ type, id, version, dirty }: { type: TranslatableType; id: string; version: number; dirty: boolean }) {
  const q = useRecordSeo(type, id, version);
  const [locale, setLocale] = useState<Locale>('en');

  return (
    <Card
      title="Проверка SEO"
      description="Так страница выглядит в поиске. Ошибки блокируют публикацию; предупреждения и подсказки — нет. Черновик проверяется так, как если бы он был опубликован."
    >
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <Alert tone="danger" action={<Button size="sm" onClick={() => void q.refetch()}>Повторить</Button>}>
          Не удалось выполнить проверку SEO.
        </Alert>
      ) : (
        <SeoPanelBody data={q.data} locale={locale} setLocale={setLocale} dirty={dirty} />
      )}
    </Card>
  );
}

type Report = { summary: { blocking: number; warning: number; info: number }; meta: Array<{ locale: Locale; servedLocale: Locale; url: string; title: string; description: string; titleSource: string; descriptionSource: string; indexable: boolean }>; issues: SeoIssueView[] };

function SeoPanelBody({ data, locale, setLocale, dirty }: { data: Report; locale: Locale; setLocale: (l: Locale) => void; dirty: boolean }) {
  const meta = data.meta.find((m) => m.locale === locale);
  const issues = sortIssues(data.issues.filter((i) => i.locale === null || i.locale === locale));
  const countFor = (l: Locale) => data.issues.filter((i) => i.locale === l && i.severity !== 'info').length;

  return (
    <div className="space-y-4" data-seo-panel>
      {dirty ? <Alert tone="info">Проверка показывает последнюю сохранённую версию — сохраните изменения, чтобы проверить их.</Alert> : null}
      <p className="text-[13px]" aria-live="polite">
        {data.summary.blocking ? <span className="font-medium text-danger">Ошибок: {data.summary.blocking}. </span> : <span className="font-medium text-ok">Блокирующих ошибок нет. </span>}
        <span className="text-ink-muted">
          Предупреждений: {data.summary.warning} · подсказок: {data.summary.info} (все языки)
        </span>
      </p>

      {data.meta.length ? (
        <>
          <div role="radiogroup" aria-label="Язык проверки" className="flex flex-wrap gap-1.5">
            {CONTENT_LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={l === locale}
                onClick={() => setLocale(l)}
                className={cx(
                  'rounded-md border px-2.5 py-1 font-mono text-xs font-semibold',
                  l === locale ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong text-ink-muted hover:bg-subtle'
                )}
              >
                {LOCALE_INFO[l].short}
                {countFor(l) ? <span className="ml-1 font-sans font-normal">· {countFor(l)}</span> : null}
              </button>
            ))}
          </div>
          {meta ? (
            <figure className="rounded-md border border-line bg-surface p-3" aria-label="Сниппет в поиске" dir={LOCALE_INFO[locale].dir} lang={meta.servedLocale}>
              <p className="truncate text-xs text-ink-muted" dir="ltr">
                {snippetUrl(meta.url)}
              </p>
              <p className="mt-0.5 text-[17px] leading-snug text-info" data-snippet-title>
                {snippetTitle(meta.title) || <span className="text-danger">(пустой заголовок)</span>}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted" data-snippet-description>
                {snippetDescription(meta.description) || <span className="text-danger">(пустое описание)</span>}
              </p>
            </figure>
          ) : null}
          {meta ? (
            <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-ink-muted sm:grid-cols-2">
              <li>
                Заголовок: <span className={cx('tabular-nums', meta.title.length > SEO_TITLE_RECOMMENDED_MAX && 'font-medium text-warn')}>{meta.title.length}</span> / {SEO_TITLE_RECOMMENDED_MAX} ·{' '}
                {meta.titleSource === 'override' ? 'задан вручную' : 'шаблон по умолчанию'}
              </li>
              <li>
                Описание:{' '}
                <span className={cx('tabular-nums', (meta.description.length < SEO_DESCRIPTION_RECOMMENDED_MIN || meta.description.length > SEO_DESCRIPTION_RECOMMENDED_MAX) && 'font-medium text-warn')}>
                  {meta.description.length}
                </span>{' '}
                / {SEO_DESCRIPTION_RECOMMENDED_MIN}–{SEO_DESCRIPTION_RECOMMENDED_MAX} · {meta.descriptionSource === 'override' ? 'задано вручную' : 'из описания'}
              </li>
              {meta.servedLocale !== meta.locale ? <li className="sm:col-span-2">Перевод не утверждён: на этом адресе показывается английская версия.</li> : null}
              {!meta.indexable ? <li className="sm:col-span-2">Страница скрыта от поисковиков (noindex) и не попадает в sitemap.</li> : null}
            </ul>
          ) : null}
        </>
      ) : null}

      {issues.length ? (
        <ul className="divide-y divide-line text-[13px]" aria-label="Замечания SEO">
          {issues.map((i, n) => (
            <li key={n} className="flex items-start gap-2 py-2" data-seo-issue={i.code} data-severity={i.severity}>
              {ICON[i.severity]}
              <span className="min-w-0 flex-1">
                <span className="sr-only">{SR[i.severity]}</span>
                {describeSeoIssue(i)}
                {i.locale ? <span className="ml-1 font-mono text-xs text-ink-muted">{LOCALE_INFO[i.locale].short}</span> : null}
              </span>
              {i.field && i.severity !== 'info' ? (
                <Button size="sm" variant="ghost" onClick={() => focusField(i.field)}>
                  Перейти к полю
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] text-ink-muted">Замечаний для этого языка нет.</p>
      )}
    </div>
  );
}
