/**
 * Pieces shared by the content lists and editors: status, translation states, the editor action
 * bar, conflict and save handling.
 */
import { useEffect, type ReactNode } from 'react';
import { CONTENT_LOCALES, TRANSLATED_LOCALES } from '@soltex/core/domain';
import { describeError } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Layout';
import { Status } from '../../components/ui/Status';
import { Link } from 'react-router-dom';
import { LOCALE_LABELS, STATUS_LABELS, STATUS_TONES, TR_STATE_LABELS, TR_STATE_TONES } from './model';

export type ContentStatus = keyof typeof STATUS_LABELS;
export type TrState = keyof typeof TR_STATE_LABELS;

export const StatusBadge = ({ status }: { status: ContentStatus }) => <Status tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Status>;

/** «5 из 5» translated, as words: no codes in the table. */
export function TranslationsSummaryText({ translations }: { translations: Record<string, TrState> }) {
  const n = TRANSLATED_LOCALES.filter((l) => translations[l] === 'approved').length;
  const total = TRANSLATED_LOCALES.length;
  return <Status tone={n === total ? 'ok' : n === 0 ? 'neutral' : 'warn'}>{n === total ? 'Все языки' : `${n} из ${total}`}</Status>;
}

/** Language versions: the source language is edited here; translations are managed in «Переводы» (Phase F). */
export function TranslationsCard({ translations, type, id }: { translations: Record<string, { status: TrState }>; type: string; id: string }) {
  return (
    <Card
      title="Языковые версии"
      description="Здесь редактируется английская (исходная) версия. Переводы ведутся в разделе «Переводы»; после изменения английского текста утверждённые переводы помечаются как устаревшие."
      actions={
        <Link to={`/translations/all?entity=${id}`} className="text-[13px] font-medium text-accent hover:underline">
          Все переводы
        </Link>
      }
    >
      <ul className="flex flex-wrap gap-2" aria-label="Состояние переводов">
        {CONTENT_LOCALES.map((l) => {
          const st = l === 'en' ? null : translations[l]?.status ?? 'missing';
          return (
            <li key={l}>
              {st === null ? (
                <span className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent-soft px-2.5 py-1.5 text-[13px]">
                  <span className="font-mono text-xs font-semibold">{LOCALE_LABELS[l]}</span>
                  <span>Исходный язык</span>
                </span>
              ) : (
                <Link to={`/translations/${type}/${id}/${l}`} className="flex items-center gap-2 rounded-md border border-line px-2.5 py-1.5 text-[13px] hover:bg-subtle">
                  <span className="font-mono text-xs font-semibold">{LOCALE_LABELS[l]}</span>
                  <Status tone={TR_STATE_TONES[st]}>{TR_STATE_LABELS[st]}</Status>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function ConflictAlert({ onReload }: { onReload: () => void }) {
  return (
    <Alert tone="danger" title="Запись была изменена другим пользователем. Обновите страницу перед сохранением." action={<Button size="sm" onClick={onReload}>Обновить</Button>}>
      Ваши несохранённые изменения не записаны. После обновления вы увидите текущую версию; перенесите свои правки заново.
    </Alert>
  );
}

/** Sticky bar with the save state and actions; ⌘/Ctrl+S saves (never publishes). */
export function EditorBar({
  dirty,
  saving,
  canSave,
  onSave,
  onReset,
  updatedAt,
  updatedBy,
  extra,
}: {
  dirty: boolean;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  onReset: () => void;
  updatedAt: string;
  updatedBy: { name: string } | null;
  extra?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty && canSave && !saving) onSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, canSave, saving, onSave]);
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-[13px] text-ink-muted" role="status">
          {dirty ? <span className="font-medium text-warn">Есть несохранённые изменения</span> : `Сохранено ${formatDateTime(updatedAt)}${updatedBy ? ` · ${updatedBy.name}` : ''}`}
        </p>
        {extra}
        {dirty ? (
          <Button onClick={onReset} disabled={saving}>
            Отменить изменения
          </Button>
        ) : null}
        {canSave ? (
          <Button variant="primary" onClick={onSave} loading={saving} disabled={!dirty}>
            Сохранить
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export const saveErrorMessage = (e: unknown) => describeError(e).message;

export { apiFieldErrors } from './field-errors';
