/**
 * Choosing a media file in the editors. Previews come from the API (same origin, Phase J-1), and a
 * new file can be uploaded right here (media.upload) and picked in one step.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Film, Image as ImageIcon, Search } from 'lucide-react';
import { api } from '../../lib/api/client';
import type { MediaItem } from '../../lib/api/schema.gen';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { cx } from '../../components/ui/cx';
import { useCan } from '../../lib/session';
import { MEDIA_TYPES } from '@soltex/core/domain';
import { previewSrc } from '../media/model';
import { UploadList, UploadZone, useMediaUpload } from '../media/upload';

export const MEDIA_KEY = ['content', 'media'] as const;

export function useMedia() {
  return useQuery({ queryKey: MEDIA_KEY, queryFn: () => api('GET /api/v1/content/media'), staleTime: 5 * 60_000 });
}

/** Preview URL of an image (the API renders a small WebP; cached per version). */
export const previewUrl = (m: Pick<MediaItem, 'id' | 'version'>): string => previewSrc(m);

export const fileName = (m: Pick<MediaItem, 'fileName'>) => m.fileName;

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
  const can = useCan();
  const up = useMediaUpload();
  const [kindError, setKindError] = useState<string | null>(null);
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
      description="Файлы из медиатеки сайта. Новый файл можно загрузить здесь же — он сразу будет выбран."
    >
      {can('media.upload') ? (
        <div className="mb-3 space-y-2">
          <UploadZone
            compact
            multiple={false}
            disabled={up.busy}
            onFiles={async (files) => {
              const ext = files[0]!.name.toLowerCase().split('.').pop() ?? '';
              const fileKind = MEDIA_TYPES.find((t) => t.ext === ext || (ext === 'jpeg' && t.ext === 'jpg'))?.kind;
              if (fileKind && fileKind !== kind) {
                setKindError(kind === 'image' ? 'Здесь нужно изображение, а выбран видеофайл.' : 'Здесь нужно видео, а выбрано изображение.');
                return;
              }
              setKindError(null);
              const [res] = await up.upload(files);
              if (res?.state === 'done' && res.id) {
                onPick(res.id);
                up.clear();
                onOpenChange(false);
              }
            }}
          />
          {kindError ? <p className="text-xs font-medium text-danger">{kindError}</p> : null}
          <UploadList items={up.items} />
        </div>
      ) : null}
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
