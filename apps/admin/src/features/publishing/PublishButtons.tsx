/**
 * «Отметить к публикации» / «Снять с публикации» in the content editors (content.publish).
 * Changes only the working copy: the record goes to (or leaves) the site with the next release.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, Undo2 } from 'lucide-react';
import { api, isApiError } from '../../lib/api/client';
import { useCan } from '../../lib/session';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';
import type { TranslatableType } from '../translations/model';

export function PublishButtons({
  type,
  id,
  status,
  version,
  dirty,
  title,
  onChanged,
  onConflict,
  onErrors,
}: {
  type: TranslatableType;
  id: string;
  status: string;
  version: number;
  dirty: boolean;
  title: string;
  onChanged: () => void;
  onConflict: () => void;
  onErrors?: (errors: Record<string, string>) => void;
}) {
  const can = useCan();
  const toast = useToast();
  const [confirm, setConfirm] = useState<'publish' | 'unpublish' | null>(null);
  const [busy, setBusy] = useState(false);
  if (!can('content.publish') || status === 'archived') return null;

  const run = async (action: 'publish' | 'unpublish') => {
    setBusy(true);
    try {
      await api(`POST /api/v1/content/${type}/{id}/${action}` as 'POST /api/v1/content/projects/{id}/publish', { params: { id }, headers: { 'if-match': `"${version}"` } });
      toast.success(action === 'publish' ? 'Отмечено к публикации. На сайте появится со следующим релизом.' : 'Снято с публикации. С сайта уйдёт со следующим релизом.');
      onChanged();
    } catch (e) {
      if (isApiError(e, 'edit_conflict')) onConflict();
      else {
        if (isApiError(e, 'validation_failed') && onErrors)
          onErrors(Object.fromEntries(e.fieldErrors.map((f) => [f.field.split('.')[0]!, f.message === 'unpublished_reference' ? 'Связанный материал не опубликован.' : 'Заполните поле перед публикацией.'])));
        toast.error(e);
      }
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <>
      {status === 'draft' ? (
        <Button size="sm" icon={<Send className="size-3.5" aria-hidden />} onClick={() => setConfirm('publish')} disabled={dirty || busy} title={dirty ? 'Сначала сохраните изменения' : undefined}>
          Отметить к публикации
        </Button>
      ) : (
        <Button size="sm" icon={<Undo2 className="size-3.5" aria-hidden />} onClick={() => setConfirm('unpublish')} disabled={dirty || busy} title={dirty ? 'Сначала сохраните изменения' : undefined}>
          Снять с публикации
        </Button>
      )}
      <ConfirmDialog
        open={confirm === 'publish'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Отметить «${title}» к публикации?`}
        consequences={[
          'Запись войдёт в следующий релиз.',
          'На сайте она появится после публикации релиза (Публикация → Релизы).',
          <>
            Проверка перед отметкой: все английские тексты заполнены, связанные материалы опубликованы.{' '}
            <Link className="text-accent underline" to="/publishing">
              Публикация
            </Link>
          </>,
        ]}
        confirmLabel="Отметить к публикации"
        destructive={false}
        busy={busy}
        onConfirm={() => void run('publish')}
      />
      <ConfirmDialog
        open={confirm === 'unpublish'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Снять «${title}» с публикации?`}
        consequences={['Запись станет черновиком.', 'С сайта она исчезнет после публикации следующего релиза; ссылки на неё перестанут работать.', 'Тексты и переводы сохраняются.']}
        confirmLabel="Снять с публикации"
        busy={busy}
        onConfirm={() => void run('unpublish')}
      />
    </>
  );
}
