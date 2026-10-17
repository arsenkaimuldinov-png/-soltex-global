/**
 * Обзор (review §X, Phase L): the user's sign-in security and the numbers of the sections their role
 * can read — leads, SEO, content and publishing, translations, media — each a link to the filtered
 * list it counts (features/overview/model.ts). «Недавно изменено» lists the last edits. No charts,
 * no placeholder numbers: a block the role may not read is not shown.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { MFA_REQUIREMENT_LABELS, ROLE_LABELS } from '../../i18n/ru';
import { api } from '../../lib/api/client';
import type { Dashboard } from '../../lib/api/schema.gen';
import { formatDateTime, plural } from '../../lib/format';
import { useCan, useSessionView } from '../../lib/session';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, Facts, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { ReleaseRef } from './ReleaseRef';
import { Status } from '../../components/ui/Status';
import { cx } from '../../components/ui/cx';
import { ACCOUNT_ITEM, visibleNav } from '../../app/nav';
import { TYPE_LABELS, type TranslatableType } from '../translations/model';
import { contentMetrics, formatDuration, leadMetrics, mediaMetrics, seoMetrics, translationMetrics, type Metric } from './model';

export const DASHBOARD_KEY = ['dashboard'] as const;

function MetricList({ items }: { items: Metric[] }) {
  return (
    <ul className="divide-y divide-line">
      {items.map((m) => (
        <li key={m.id}>
          <Link to={m.to} className="group flex items-center gap-3 py-2 text-[13px]" data-metric={m.id}>
            <span className="min-w-0 flex-1 group-hover:text-accent">{m.label}</span>
            <span className={cx('font-semibold tabular-nums', m.attention && m.value > 0 ? 'text-warn' : m.value === 0 ? 'text-ink-muted' : 'text-ink')}>{m.value}</span>
            <ArrowRight className="size-3.5 text-ink-faint group-hover:text-accent" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PublishingCard({ p }: { p: NonNullable<Dashboard['publishing']> }) {
  const b = p.lastBuild;
  return (
    <Card
      title="Публикация сайта"
      actions={
        <Link to="/publishing" className="text-[13px] text-accent hover:underline">
          Открыть
        </Link>
      }
    >
      <Facts
        items={[
          {
            label: 'На сайте',
            value: <ReleaseRef release={p.active} />,
          },
          {
            label: 'Последняя сборка',
            value: !b ? (
              '—'
            ) : (
              <span>
                <Status tone={b.ok ? 'ok' : 'danger'}>{b.ok ? 'Успешно' : 'Не удалась'}</Status>
                <span className="block text-xs text-ink-muted">
                  {formatDateTime(b.finishedAt)}
                  {b.durationSeconds !== null ? ` · ${formatDuration(b.durationSeconds)}` : ''}
                  {b.reason ? ` · ${b.reason}` : ''}
                </span>
              </span>
            ),
          },
          ...(p.running
            ? [
                {
                  label: 'Сейчас собирается',
                  value: `${p.running} ${plural(p.running, 'релиз', 'релиза', 'релизов')}`,
                },
              ]
            : []),
        ]}
      />
    </Card>
  );
}

export function OverviewPage() {
  const view = useSessionView();
  const can = useCan();
  const { mfa } = view;
  const lowCodes = mfa.enrolled && mfa.recoveryCodesLeft <= 3;
  const dash = useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: () => api('GET /api/v1/dashboard'),
    staleTime: 30_000,
  });
  const d: Dashboard = dash.data ?? {};
  const hasBlocks = Object.keys(d).length > 0;
  const sections = visibleNav(can)
    .flatMap((s) => s.items)
    .filter((i) => i.id !== 'overview');

  return (
    <>
      <PageHeader title="Обзор" description={`${view.user.name}, ${ROLE_LABELS[view.user.role].toLowerCase()}.`} />
      <div className="space-y-4">
        {!mfa.enrolled ? (
          <Alert
            tone="warn"
            title="Второй фактор не настроен"
            action={
              <Link to={ACCOUNT_ITEM.to} className="text-[13px] font-medium text-accent hover:underline">
                Настроить
              </Link>
            }
          >
            Вход защищён только паролем. Добавьте ключ доступа или приложение-аутентификатор.
          </Alert>
        ) : null}
        {lowCodes ? (
          <Alert
            tone="warn"
            title={
              mfa.recoveryCodesLeft === 0 ? 'Резервные коды закончились' : `Осталось ${mfa.recoveryCodesLeft} ${plural(mfa.recoveryCodesLeft, 'резервный код', 'резервных кода', 'резервных кодов')}`
            }
            action={
              <Link to={`${ACCOUNT_ITEM.to}#recovery`} className="text-[13px] font-medium text-accent hover:underline">
                Создать новые
              </Link>
            }
          >
            Резервные коды нужны, если вы потеряете устройство.
          </Alert>
        ) : null}

        {dash.isPending ? (
          <LoadingBlock />
        ) : dash.isError ? (
          <Alert
            tone="danger"
            action={
              <Button size="sm" onClick={() => void dash.refetch()}>
                Повторить
              </Button>
            }
          >
            Не удалось загрузить сводку.
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-dashboard>
          {d.leads ? (
            <Card
              title="Заявки"
              actions={
                <Link to="/leads" className="text-[13px] text-accent hover:underline">
                  Все заявки
                </Link>
              }
            >
              <MetricList items={leadMetrics(d.leads)} />
              {!d.leads.formsLive ? <p className="mt-2 text-xs text-ink-muted">Формы сайта пока в демонстрационном режиме: заявки с сайта не приходят.</p> : null}
            </Card>
          ) : null}
          {d.seo ? (
            <Card
              title="SEO"
              description="Проверка следующего релиза."
              actions={
                <Link to="/seo" className="text-[13px] text-accent hover:underline">
                  Проверка SEO
                </Link>
              }
            >
              <MetricList items={seoMetrics(d.seo)} />
            </Card>
          ) : null}
          {d.content ? (
            <Card title="Контент">
              <MetricList items={contentMetrics(d.content)} />
              {!d.content.drafts.length ? <p className="mt-2 text-xs text-ink-muted">Черновиков нет.</p> : null}
            </Card>
          ) : null}
          {d.publishing ? <PublishingCard p={d.publishing} /> : null}
          {d.media ? (
            <Card
              title="Медиатека"
              description={`${d.media.total} ${plural(d.media.total, 'файл', 'файла', 'файлов')}.`}
              actions={
                <Link to="/media" className="text-[13px] text-accent hover:underline">
                  Открыть
                </Link>
              }
            >
              <MetricList items={mediaMetrics(d.media)} />
            </Card>
          ) : null}
          {d.translations ? (
            <Card
              title="Переводы"
              actions={
                <Link to="/translations" className="text-[13px] text-accent hover:underline">
                  Обзор переводов
                </Link>
              }
            >
              <table className="w-full text-[13px]" aria-label="Переводы по языкам">
                <thead>
                  <tr className="text-left text-xs text-ink-muted">
                    <th className="pb-1 font-normal">Язык</th>
                    <th className="pb-1 text-right font-normal">Готово</th>
                    <th className="pb-1 text-right font-normal">Нет</th>
                    <th className="pb-1 text-right font-normal">Устарели</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {translationMetrics(d.translations).map((l) => (
                    <tr key={l.locale}>
                      <td className="py-1.5">{l.name}</td>
                      <td className="py-1.5 text-right tabular-nums">{l.completion}%</td>
                      {l.metrics.map((m) => (
                        <td key={m.id} className="py-1.5 text-right">
                          <Link
                            to={m.to}
                            data-metric={m.id}
                            aria-label={`${l.name}: ${m.label.toLowerCase()} — ${m.value}`}
                            className={cx('tabular-nums hover:text-accent hover:underline', m.attention && m.value > 0 ? 'font-semibold text-warn' : m.value === 0 ? 'text-ink-muted' : '')}
                          >
                            {m.value}
                          </Link>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ) : null}
          {d.content ? (
            <Card title="Недавно изменено">
              {d.content.recent.length ? (
                <ul className="divide-y divide-line" aria-label="Недавно изменено">
                  {d.content.recent.map((r) => (
                    <li key={`${r.type}:${r.id}:${r.at}`} className="py-2 text-[13px]">
                      <Link to={`/content/${r.type}/${r.id}`} className="font-medium hover:text-accent hover:underline">
                        {r.title}
                      </Link>
                      <span className="block text-xs text-ink-muted">
                        {TYPE_LABELS[r.type as TranslatableType]} · {formatDateTime(r.at)}
                        {r.by ? ` · ${r.by}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-ink-muted">Изменений пока не было.</p>
              )}
            </Card>
          ) : null}
          <Card
            title="Безопасность входа"
            actions={
              <Link to={ACCOUNT_ITEM.to} className="text-[13px] text-accent hover:underline">
                Управление
              </Link>
            }
          >
            <Facts
              items={[
                {
                  label: 'Требование для роли',
                  value: MFA_REQUIREMENT_LABELS[mfa.requirement],
                },
                {
                  label: 'Ключи доступа',
                  value: mfa.passkeys ? <Status tone="ok">{`${mfa.passkeys} ${plural(mfa.passkeys, 'ключ', 'ключа', 'ключей')}`}</Status> : <Status tone="neutral">Нет</Status>,
                },
                {
                  label: 'Приложение-аутентификатор',
                  value: mfa.totp ? <Status tone="ok">Подключено</Status> : <Status tone="neutral">Не подключено</Status>,
                },
                {
                  label: 'Резервные коды',
                  value: mfa.enrolled ? `${mfa.recoveryCodesLeft} из 10` : '—',
                },
              ]}
            />
          </Card>
          {dash.isSuccess && !hasBlocks ? (
            <Card title="Разделы">
              {sections.length ? (
                <ul className="divide-y divide-line">
                  {sections.map((s) => (
                    <li key={s.id}>
                      <Link to={s.to} className="flex items-center gap-3 py-2.5 text-[13px] hover:text-accent">
                        <s.icon className="size-4 text-ink-muted" aria-hidden />
                        <span className="flex-1">{s.title ?? s.label}</span>
                        <ArrowRight className="size-3.5 text-ink-faint" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-ink-muted">Для вашей роли пока нет доступных разделов, кроме профиля.</p>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
