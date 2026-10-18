/**
 * One lead (Phase K-1): contacts with tel:/mailto: links, the message, where it came from, the
 * consent record, the notification state; status and assignee (leads.manage), notes, history,
 * bin / restore. Anonymized leads show only what remains (date, form, language, page, status).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LEAD_STATUSES, type LeadStatus } from '@soltex/core/domain';
import { api, isApiError } from '../../lib/api/client';
import type { LeadDetail } from '../../lib/api/schema.gen';
import { formatDateTime } from '../../lib/format';
import { useCan } from '../../lib/session';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { CopyButton } from '../../components/ui/CopyButton';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Field, Select } from '../../components/ui/Field';
import { Card, Facts, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { Status } from '../../components/ui/Status';
import { useToast } from '../../components/ui/Toast';
import {
  describeLeadEvent,
  describeTouch,
  LEAD_FORM_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_TONES,
  LEADS_KEY,
  LOCALE_LABELS,
  NOTIFICATION_LABELS,
  notifyErrorText,
  SPAM_REASON_LABELS,
  telHref,
} from './model';

export function LeadDetailPage() {
  const { id = '' } = useParams();
  const can = useCan();
  const manage = can('leads.manage');
  const qc = useQueryClient();
  const toast = useToast();
  const key = [...LEADS_KEY, 'detail', id];
  const q = useQuery({ queryKey: key, queryFn: () => api('GET /api/v1/leads/{id}', { params: { id } }), retry: false });
  const people = useQuery({ queryKey: [...LEADS_KEY, 'assignees'], queryFn: () => api('GET /api/v1/leads/assignees'), staleTime: 5 * 60_000 });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (what: string, fn: () => Promise<LeadDetail>, done: string) => {
    setBusy(what);
    try {
      const next = await fn();
      qc.setQueryData(key, next);
      void qc.invalidateQueries({ queryKey: [...LEADS_KEY, 'list'] });
      toast.success(done);
      return true;
    } catch (e) {
      if (isApiError(e, 'edit_conflict')) {
        toast.error(e, 'Заявку изменил другой пользователь — показана актуальная версия.');
        void q.refetch();
      } else toast.error(e);
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (q.isPending) return <LoadingBlock />;
  const l = q.data;
  if (q.isError || !l)
    return (
      <>
        <PageHeader title="Заявка" crumbs={[{ label: 'Заявки', to: '/leads' }]} />
        <Alert tone="danger">{isApiError(q.error, 'not_found') ? 'Заявка не найдена.' : 'Не удалось загрузить заявку.'}</Alert>
      </>
    );

  const editable = manage && !l.deletedAt && !l.anonymizedAt;
  const nameOf = (uid: string | null) => (people.data?.items ?? []).find((p) => p.id === uid)?.name ?? (l.assignee?.id === uid ? l.assignee.name : 'сотрудник');
  const ifMatch = { 'if-match': `"${l.version}"` };

  return (
    <>
      <PageHeader
        title={l.reference}
        description={`Получена ${formatDateTime(l.createdAt)} · ${LEAD_FORM_LABELS[l.formType]}`}
        crumbs={[{ label: 'Заявки', to: '/leads' }, { label: l.reference }]}
        actions={
          manage && !l.anonymizedAt ? (
            l.deletedAt ? (
              <Button loading={busy === 'restore'} onClick={() => void run('restore', () => api('POST /api/v1/leads/{id}/restore', { params: { id }, headers: ifMatch }), 'Заявка восстановлена')}>
                Восстановить
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                В корзину
              </Button>
            )
          ) : undefined
        }
      />
      <div className="space-y-4">
        {l.anonymizedAt ? <Alert tone="info">Заявка обезличена {formatDateTime(l.anonymizedAt)}: личные данные удалены, остались дата, форма, язык, страница и статус.</Alert> : null}
        {l.deletedAt && !l.anonymizedAt ? <Alert tone="warn">Заявка в корзине с {formatDateTime(l.deletedAt)}. Через 30 дней её личные данные будут удалены.</Alert> : null}
        {l.status === 'spam' && l.spamReasons.length ? (
          <Alert tone="warn">Помечена как спам: {l.spamReasons.map((r) => SPAM_REASON_LABELS[r] ?? r).join(', ')}. Если это ошибка, смените статус.</Alert>
        ) : null}
        {l.notification === 'failed' ? (
          <Alert
            tone="danger"
            action={
              manage ? (
                <Button size="sm" loading={busy === 'notify'} onClick={() => void run('notify', () => api('POST /api/v1/leads/{id}/notify', { params: { id } }), 'Уведомление поставлено в очередь')}>
                  Отправить ещё раз
                </Button>
              ) : undefined
            }
          >
            Уведомление на почту не отправлено: {notifyErrorText(l.notificationError)}. Заявка сохранена; отправка повторяется автоматически.
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-4">
            <Card title="Контакт">
              <Facts
                items={[
                  { label: 'Имя', value: l.name ?? '—' },
                  { label: 'Компания', value: l.company ?? '—' },
                  {
                    label: 'Телефон',
                    value: l.phone ? (
                      <span className="flex flex-wrap items-center gap-2" dir="ltr">
                        <a href={telHref(l.phone)} className="text-accent hover:underline">
                          {l.phone}
                        </a>
                        <CopyButton text={l.phone} label="Копировать" />
                      </span>
                    ) : (
                      '—'
                    ),
                  },
                  {
                    label: 'E-mail',
                    value: l.email ? (
                      <span className="flex flex-wrap items-center gap-2" dir="ltr">
                        <a href={`mailto:${l.email}`} className="break-all text-accent hover:underline">
                          {l.email}
                        </a>
                        <CopyButton text={l.email} label="Копировать" />
                      </span>
                    ) : (
                      '—'
                    ),
                  },
                  ...(l.duplicates ? [{ label: 'Повторы', value: <Link to={`/leads?q=${encodeURIComponent(l.email ?? l.phone ?? '')}`} className="text-accent hover:underline">ещё заявок с этими контактами: {l.duplicates}</Link> }] : []),
                ]}
              />
            </Card>
            <Card title="Сообщение">
              {l.message ? <p className="text-[13px] whitespace-pre-wrap" data-lead-message>{l.message}</p> : <p className="text-[13px] text-ink-muted">Без сообщения (форма его не содержит).</p>}
            </Card>
            <Card title="Заметки и история">
              {editable ? (
                <form
                  className="mb-4 space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!note.trim()) return;
                    if (await run('note', () => api('POST /api/v1/leads/{id}/notes', { params: { id }, body: { text: note } }), 'Заметка добавлена')) setNote('');
                  }}
                >
                  <Field label="Новая заметка" hint="Видна всем, у кого есть доступ к заявкам. Хранится в зашифрованном виде.">
                    {({ id: fid, describedBy }) => (
                      <textarea id={fid} aria-describedby={describedBy} value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={5000} className="block w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none" />
                    )}
                  </Field>
                  <Button type="submit" size="sm" loading={busy === 'note'} disabled={!note.trim()}>
                    Добавить заметку
                  </Button>
                </form>
              ) : null}
              <ol className="divide-y divide-line text-[13px]" aria-label="История заявки">
                {l.events.map((e) => (
                  <li key={e.id} className="py-2" data-event={e.kind}>
                    <span className="block text-xs text-ink-muted">
                      {formatDateTime(e.at)}
                      {e.actor ? ` · ${e.actor.name}` : ''}
                    </span>
                    <span className="block">{describeLeadEvent(e, nameOf)}</span>
                    {e.note ? <span className="mt-1 block rounded bg-subtle px-2 py-1.5 whitespace-pre-wrap">{e.note}</span> : null}
                  </li>
                ))}
              </ol>
            </Card>
          </div>
          <div className="space-y-4">
            <Card title="Работа с заявкой">
              <div className="space-y-3">
                <Field label="Статус">
                  {({ id: fid }) => (
                    <Select
                      id={fid}
                      value={l.status}
                      disabled={!editable || busy !== null}
                      onChange={(e) => void run('status', () => api('PATCH /api/v1/leads/{id}', { params: { id }, headers: ifMatch, body: { status: e.target.value as LeadStatus } }), 'Статус изменён')}
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {LEAD_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Ответственный">
                  {({ id: fid }) => (
                    <Select
                      id={fid}
                      value={l.assignee?.id ?? ''}
                      disabled={!editable || busy !== null}
                      onChange={(e) => void run('assignee', () => api('PATCH /api/v1/leads/{id}', { params: { id }, headers: ifMatch, body: { assigneeId: e.target.value || null } }), 'Ответственный назначен')}
                    >
                      <option value="">Не назначен</option>
                      {(people.data?.items ?? []).map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {!manage ? <p className="text-xs text-ink-muted">Ваша роль может только просматривать заявки.</p> : null}
              </div>
            </Card>
            <Card title="Откуда">
              <Facts
                items={[
                  { label: 'Сейчас', value: <Status tone={LEAD_STATUS_TONES[l.status]}>{LEAD_STATUS_LABELS[l.status]}</Status> },
                  { label: 'Форма', value: LEAD_FORM_LABELS[l.formType] },
                  { label: 'Тема', value: l.topic ?? '—' },
                  { label: 'Страница', value: l.pagePath ? <span className="font-mono text-xs break-all" dir="ltr">{l.pagePath}</span> : '—' },
                  { label: 'Язык сайта', value: LOCALE_LABELS[l.locale] ?? l.locale },
                  { label: 'Уведомление', value: NOTIFICATION_LABELS[l.notification] ?? l.notification },
                  ...(['first', 'last'] as const).flatMap((k) => {
                    const t = l.attribution?.[k];
                    if (!t) return [];
                    const d = describeTouch(t, formatDateTime);
                    return [
                      {
                        label: k === 'first' ? 'Первый визит' : 'Последний источник',
                        value: (
                          <span data-attribution={k}>
                            <span className="font-medium">{d.source}</span>
                            <span className="block text-xs text-ink-muted break-words">{d.details}</span>
                          </span>
                        ),
                      },
                    ];
                  }),
                  {
                    label: 'Согласие',
                    value:
                      l.consentBasis === 'notice_only'
                        ? `Показано уведомление о конфиденциальности${l.privacyNoticeVersion ? ` (версия ${l.privacyNoticeVersion})` : ' (версия текста ещё не задана)'}; галочки согласия в формах пока нет`
                        : `Посетитель отметил галочку согласия${l.privacyNoticeVersion ? ` (Политика конфиденциальности, версия ${l.privacyNoticeVersion})` : ''}`,
                  },
                ]}
              />
            </Card>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Перенести заявку в корзину?"
        consequences={['Заявка исчезнет из списка; её можно восстановить в течение 30 дней.', 'Через 30 дней имя, контакты, сообщение и заметки будут удалены безвозвратно.']}
        confirmLabel="В корзину"
        busy={busy === 'delete'}
        onConfirm={async () => {
          if (await run('delete', () => api('POST /api/v1/leads/{id}/delete', { params: { id }, headers: ifMatch }), 'Заявка перенесена в корзину')) setConfirmDelete(false);
        }}
      />
    </>
  );
}
