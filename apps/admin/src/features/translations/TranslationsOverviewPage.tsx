/**
 * «Переводы · Обзор»: completeness of every translated language (approved for the current English
 * text / all translatable records), the backlog by state and a type × language table. The counts
 * come from one aggregate API call; nothing is counted in the browser.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api/client';
import { Alert } from '../../components/ui/Alert';
import { Button, buttonClass } from '../../components/ui/Button';
import { Card, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { cx } from '../../components/ui/cx';
import { completionTone, LOCALE_INFO, STATE_LABELS, TYPE_LABELS } from './model';

export const OVERVIEW_KEY = ['translations', 'overview'] as const;

const BAR: Record<'ok' | 'warn' | 'danger', string> = { ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger' };

function Bar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <div className={cx('h-full rounded-full', BAR[completionTone(pct)])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function TranslationsOverviewPage() {
  const q = useQuery({ queryKey: OVERVIEW_KEY, queryFn: () => api('GET /api/v1/translations/overview') });
  return (
    <>
      <PageHeader
        title="Переводы"
        description="Исходный язык — английский: его тексты редактируются в разделе «Контент». Здесь — переводы на остальные языки сайта."
        crumbs={[{ label: 'Переводы' }, { label: 'Обзор' }]}
        actions={
          <Link to="/translations/attention" className={buttonClass('primary')}>
            Требуют внимания
          </Link>
        }
      />
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <Alert tone="danger" action={<Button size="sm" onClick={() => void q.refetch()}>Повторить</Button>}>
          Не удалось загрузить обзор переводов.
        </Alert>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-muted">
            Материалов для перевода: <span className="font-medium text-ink tabular-nums">{q.data.total}</span> (страницы и записи всех разделов, кроме архива). Готовность языка — доля
            переводов, утверждённых для текущей версии английского текста; устаревшие, черновые и отсутствующие переводы не засчитываются.
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5" aria-label="Готовность языков">
            {q.data.locales.map((l) => (
              <li key={l.locale} className="rounded-lg border border-line bg-surface p-4" data-locale={l.locale}>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold">
                    {LOCALE_INFO[l.locale].name} <span className="font-mono text-xs text-ink-muted">{LOCALE_INFO[l.locale].short}</span>
                  </h2>
                  <span className="text-lg font-semibold tabular-nums" data-completion>
                    {l.completion}%
                  </span>
                </div>
                <div className="mt-2">
                  <Bar pct={l.completion} label={`Готовность: ${LOCALE_INFO[l.locale].name}`} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
                  {(
                    [
                      ['approved', l.approved],
                      ['outdated', l.outdated],
                      ['in_progress', l.inProgress],
                      ['missing', l.missing],
                    ] as const
                  ).map(([state, n]) => (
                    <div key={state} className="contents">
                      <dt className="text-ink-muted">{STATE_LABELS[state]}</dt>
                      <dd className="text-right tabular-nums">
                        {n && state !== 'approved' ? (
                          <Link className="font-medium text-accent hover:underline" to={`/translations/all?locale=${l.locale}&state=${state}`}>
                            {n}
                          </Link>
                        ) : (
                          n
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>

          <Card title="По разделам" description="Готовность каждого языка в каждом разделе.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-[13px]">
                <caption className="sr-only">Готовность переводов по разделам и языкам</caption>
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-muted">
                    <th scope="col" className="py-2 pr-3 font-medium">Раздел</th>
                    <th scope="col" className="py-2 pr-3 font-medium tabular-nums">Материалов</th>
                    {q.data.locales.map((l) => (
                      <th key={l.locale} scope="col" className="py-2 pr-3 font-medium">
                        {LOCALE_INFO[l.locale].short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {q.data.types.map((t) => (
                    <tr key={t.type} className="border-b border-line last:border-0">
                      <th scope="row" className="py-2 pr-3 text-left font-medium">
                        <Link className="hover:text-accent hover:underline" to={`/translations/all?type=${t.type}`}>
                          {TYPE_LABELS[t.type]}
                        </Link>
                      </th>
                      <td className="py-2 pr-3 tabular-nums">{t.total}</td>
                      {t.locales.map((l) => (
                        <td key={l.locale} className={cx('py-2 pr-3 tabular-nums', l.completion < 100 && t.total ? 'font-medium text-warn' : '')}>
                          {t.total ? `${l.completion}%` : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
