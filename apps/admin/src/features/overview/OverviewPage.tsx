/**
 * Обзор. Phase D shows only what exists: the user's own security state and the sections their role
 * can open. The metrics of review §X (leads, SEO, translations, builds, backups) arrive with their
 * phases; no placeholder numbers are shown.
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { MFA_REQUIREMENT_LABELS, ROLE_LABELS } from '../../i18n/ru';
import { plural } from '../../lib/format';
import { useCan, useSessionView } from '../../lib/session';
import { Alert } from '../../components/ui/Alert';
import { Card, Facts, PageHeader } from '../../components/ui/Layout';
import { Status } from '../../components/ui/Status';
import { ACCOUNT_ITEM, visibleNav } from '../../app/nav';

export function OverviewPage() {
  const view = useSessionView();
  const can = useCan();
  const { mfa } = view;
  const sections = visibleNav(can).flatMap((s) => s.items).filter((i) => i.id !== 'overview');
  const lowCodes = mfa.enrolled && mfa.recoveryCodesLeft <= 3;

  return (
    <>
      <PageHeader title="Обзор" description={`${view.user.name}, ${ROLE_LABELS[view.user.role].toLowerCase()}.`} />
      <div className="space-y-4">
        {!mfa.enrolled ? (
          <Alert tone="warn" title="Второй фактор не настроен" action={<Link to={ACCOUNT_ITEM.to} className="text-[13px] font-medium text-accent hover:underline">Настроить</Link>}>
            Вход защищён только паролем. Добавьте ключ доступа или приложение-аутентификатор.
          </Alert>
        ) : null}
        {lowCodes ? (
          <Alert tone="warn" title={mfa.recoveryCodesLeft === 0 ? 'Резервные коды закончились' : `Осталось ${mfa.recoveryCodesLeft} ${plural(mfa.recoveryCodesLeft, 'резервный код', 'резервных кода', 'резервных кодов')}`} action={<Link to={`${ACCOUNT_ITEM.to}#recovery`} className="text-[13px] font-medium text-accent hover:underline">Создать новые</Link>}>
            Резервные коды нужны, если вы потеряете устройство.
          </Alert>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Card title="Безопасность входа" actions={<Link to={ACCOUNT_ITEM.to} className="text-[13px] text-accent hover:underline">Управление</Link>}>
            <Facts
              items={[
                { label: 'Требование для роли', value: MFA_REQUIREMENT_LABELS[mfa.requirement] },
                { label: 'Ключи доступа', value: mfa.passkeys ? <Status tone="ok">{`${mfa.passkeys} ${plural(mfa.passkeys, 'ключ', 'ключа', 'ключей')}`}</Status> : <Status tone="neutral">Нет</Status> },
                { label: 'Приложение-аутентификатор', value: mfa.totp ? <Status tone="ok">Подключено</Status> : <Status tone="neutral">Не подключено</Status> },
                { label: 'Резервные коды', value: mfa.enrolled ? `${mfa.recoveryCodesLeft} из 10` : '—' },
              ]}
            />
          </Card>
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
              <p className="text-[13px] text-ink-muted">Для вашей роли пока нет доступных разделов, кроме профиля. Разделы для работы с сайтом появятся в админке по мере подключения.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
