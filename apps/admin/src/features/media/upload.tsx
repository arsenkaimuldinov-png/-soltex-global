/**
 * Uploading files (Phase J-1): one at a time, each with its own state, so a refused file does not
 * stop the others. Used by «Медиатека» and by the media picker in the editors.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { CheckCircle2, CircleX, Loader2, Upload } from 'lucide-react';
import { isApiError, uploadFile } from '../../lib/api/client';
import { Button } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { describeError } from '../../lib/errors';
import { ACCEPT, ACCEPT_LABEL, formatBytes, MEDIA_ERRORS, precheckFile } from './model';

export interface UploadItem {
  name: string;
  size: number;
  state: 'waiting' | 'uploading' | 'done' | 'failed';
  message?: string;
  /** Uploaded media id, or the existing one for a duplicate. */
  id?: string;
}

export function uploadErrorMessage(e: unknown): { message: string; existingId?: string } {
  if (isApiError(e)) {
    const field = e.fieldErrors[0]?.message;
    if (e.code === 'media_duplicate') return { message: MEDIA_ERRORS.media_duplicate!, existingId: field };
    if (field && MEDIA_ERRORS[field]) return { message: MEDIA_ERRORS[field]! };
    if (MEDIA_ERRORS[e.code]) return { message: MEDIA_ERRORS[e.code]! };
  }
  return { message: describeError(e).message };
}

export function useMediaUpload() {
  const qc = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const busy = items.some((i) => i.state === 'waiting' || i.state === 'uploading');

  const upload = useCallback(
    async (files: File[]): Promise<UploadItem[]> => {
      const start: UploadItem[] = files.map((f) => {
        const problem = precheckFile(f);
        return { name: f.name, size: f.size, state: problem ? 'failed' : 'waiting', message: problem ?? undefined };
      });
      setItems(start);
      const done = [...start];
      for (let i = 0; i < files.length; i++) {
        if (done[i]!.state === 'failed') continue;
        done[i] = { ...done[i]!, state: 'uploading' };
        setItems([...done]);
        try {
          const res = await uploadFile('POST /api/v1/media', files[i]!, { query: { name: files[i]!.name } });
          done[i] = { ...done[i]!, state: 'done', id: res.id };
        } catch (e) {
          const err = uploadErrorMessage(e);
          done[i] = { ...done[i]!, state: 'failed', message: err.message, id: err.existingId };
        }
        setItems([...done]);
      }
      void qc.invalidateQueries({ queryKey: ['media'] });
      void qc.invalidateQueries({ queryKey: ['content', 'media'] });
      return done;
    },
    [qc]
  );

  return { items, busy, upload, clear: () => setItems([]) };
}

/** Drop zone + «Выбрать файлы». */
export function UploadZone({ onFiles, disabled, multiple = true, compact }: { onFiles: (files: File[]) => void; disabled?: boolean; multiple?: boolean; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    const files = [...e.dataTransfer.files];
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cx('rounded-lg border border-dashed px-4 text-center transition-colors', compact ? 'py-3' : 'py-6', over ? 'border-accent bg-accent-soft' : 'border-line-strong bg-subtle/50')}
      data-upload-zone
    >
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        className="sr-only"
        aria-label="Файлы для загрузки"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
      <Button variant="primary" size={compact ? 'sm' : 'md'} icon={<Upload className="size-4" aria-hidden />} disabled={disabled} onClick={() => input.current?.click()}>
        {multiple ? 'Выбрать файлы' : 'Выбрать файл'}
      </Button>
      <p className="mt-2 text-xs text-ink-muted">
        или перетащите сюда · {ACCEPT_LABEL} · изображения до 20 МБ, видео до 200 МБ
      </p>
    </div>
  );
}

const STATE_ICON: Record<UploadItem['state'], ReactNode> = {
  waiting: <Loader2 className="size-4 shrink-0 text-ink-faint" aria-hidden />,
  uploading: <Loader2 className="size-4 shrink-0 animate-spin text-accent" aria-hidden />,
  done: <CheckCircle2 className="size-4 shrink-0 text-ok" aria-hidden />,
  failed: <CircleX className="size-4 shrink-0 text-danger" aria-hidden />,
};
const STATE_TEXT: Record<UploadItem['state'], string> = { waiting: 'в очереди', uploading: 'загружается…', done: 'загружен', failed: 'не загружен' };

export function UploadList({ items, renderExtra }: { items: UploadItem[]; renderExtra?: (item: UploadItem) => ReactNode }) {
  if (!items.length) return null;
  return (
    <ul className="divide-y divide-line rounded-md border border-line text-[13px]" aria-label="Загрузка файлов" aria-live="polite">
      {items.map((i, n) => (
        <li key={n} className="flex items-start gap-2 px-3 py-2" data-upload-item={i.state}>
          {STATE_ICON[i.state]}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{i.name}</span>
            <span className={cx('block text-xs', i.state === 'failed' ? 'text-danger' : 'text-ink-muted')}>
              {formatBytes(i.size)} · {STATE_TEXT[i.state]}
              {i.message ? ` — ${i.message}` : ''}
            </span>
          </span>
          {renderExtra?.(i)}
        </li>
      ))}
    </ul>
  );
}
