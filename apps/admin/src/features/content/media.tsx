/**
 * Choosing an existing media file (approved §23: the media library with uploads is Phase J).
 * Files are named by their file name, size and alt text; a preview is shown only when the admin
 * build knows where the public site serves files (VITE_MEDIA_BASE_URL, see docs/admin-content.md §6).
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Film, Image as ImageIcon, Search } from 'lucide-react';
import { api } from '../../lib/api/client';
import type { MediaItem } from '../../lib/api/schema.gen';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { cx } from '../../components/ui/cx';

export const MEDIA_KEY = ['content', 'media'] as const;

export function useMedia() {
  return useQuery({ queryKey: MEDIA_KEY, queryFn: () => api('GET /api/v1/content/media'), staleTime: 5 * 60_000 });
}

const BASE = (import.meta.env.VITE_MEDIA_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

/** Preview URL of a media file, or null when previews are not configured. */
export function previewUrl(m: Pick<MediaItem, 'src'>): string | null {
  if (!BASE) return null;
  if (/^https?:\/\//.test(m.src)) return m.src;
  return `${BASE}${m.src.startsWith('/') ? '' : '/'}${m.src}`;
}

export const fileName = (m: Pick<MediaItem, 'src'>) => decodeURIComponent(m.src.split('/').pop() ?? m.src);

export function MediaSummary({ item, empty = 'Не выбрано' }: { item: MediaItem | undefined | null; empty?: string }) {
  if (!item) return <span className="text-ink-muted">{empty}</span>;
  const url = item.kind === 'image' ? previewUrl(item) : null;
  const Icon = item.kind === 'video' ? Film : ImageIcon;
  return (
    <span className="flex min-w-0 items-center gap-3">
      {url ? (
        <img src={url} alt="" loading="lazy" className="size-12 shrink-0 rounded border border-line object-cover" />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded border border-line bg-subtle text-ink-muted" aria-hidden>
          <Icon className="size-5" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-ink">{fileName(item)}</span>
        <span className="block truncate text-xs text-ink-muted">
          {item.width && item.height ? `${item.width} × ${item.height}` : item.kind === 'video' ? 'Видео' : 'Изображение'}
          {item.alt ? ` · ${item.alt}` : ''}
        </span>
      </span>
    </span>
  );
}

export function MediaPicker({
  open,
  onOpenChange,
  kind,
  onPick,
  exclude = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  kind: 'image' | 'video';
  onPick: (id: string) => void;
  exclude?: readonly string[];
}) {
  const media = useMedia();
  const [q, setQ] = useState('');
  const items = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('ru');
    return (media.data?.items ?? [])
      .filter((m) => m.kind === kind && !exclude.includes(m.id))
      .filter((m) => !needle || `${fileName(m)} ${m.alt ?? ''}`.toLocaleLowerCase('ru').includes(needle));
  }, [media.data, q, kind, exclude]);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={kind === 'image' ? 'Выберите изображение' : 'Выберите видео'}
      description="Файлы из медиатеки сайта. Загрузка новых файлов появится в разделе «Медиатека»."
    >
      <label className="relative mb-3 block">
        <span className="sr-only">Поиск файла</span>
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск по имени файла или описанию"
          className="h-9 w-full rounded-md border border-line-strong bg-surface pr-3 pl-8 text-sm focus:border-accent focus:outline-none"
        />
      </label>
      <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-md border border-line" aria-label="Файлы">
        {items.length === 0 ? <li className="px-3 py-6 text-center text-[13px] text-ink-muted">{media.isPending ? 'Загрузка…' : 'Ничего не найдено'}</li> : null}
        {items.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className={cx('flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-subtle focus:bg-accent-soft focus:outline-none')}
              onClick={() => {
                onPick(m.id);
                onOpenChange(false);
              }}
            >
              <MediaSummary item={m} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-end">
        <Button onClick={() => onOpenChange(false)}>Отмена</Button>
      </div>
    </Dialog>
  );
}
