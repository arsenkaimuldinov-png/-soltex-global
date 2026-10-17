/**
 * «Медиатека» (Phase J-1, docs/admin-media.md): every file with a preview, size, dimensions and
 * how often it is used; search and filters kept in the address; upload by button or drag and drop.
 * A card opens the file's page (usages, replace, delete).
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Film, Search } from 'lucide-react';
import { api } from '../../lib/api/client';
import type { MediaFile } from '../../lib/api/schema.gen';
import { plural } from '../../lib/format';
import { useCan } from '../../lib/session';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Field';
import { Card, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Status';
import { formatBytes, KIND_LABELS, MEDIA_LIST_KEY, previewSrc, WARNING_LABELS } from './model';
import { UploadList, UploadZone, useMediaUpload } from './upload';

export function MediaThumb({ item, className = 'aspect-[4/3] w-full' }: { item: Pick<MediaFile, 'id' | 'kind' | 'version'>; className?: string }) {
  return item.kind === 'image' ? (
    <img src={previewSrc(item)} alt="" loading="lazy" decoding="async" className={`${className} bg-subtle object-cover`} />
  ) : (
    <span className={`${className} flex items-center justify-center bg-subtle text-ink-muted`} aria-hidden>
      <Film className="size-8" />
    </span>
  );
}

export function MediaLibraryPage() {
  const can = useCan();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const kind = (params.get('kind') ?? '') as '' | 'image' | 'video';
  const usage = (params.get('usage') ?? '') as '' | 'used' | 'unused';
  // «Обзор» links here (Phase L): files with a warning or image copies that could not be made.
  const attention = params.get('attention') === 'true';
  const set = (k: string, v: string) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (v) n.set(k, v);
        else n.delete(k);
        return n;
      },
      { replace: true }
    );

  const list = useQuery({
    queryKey: [...MEDIA_LIST_KEY, { q, kind, usage, attention }],
    queryFn: () => api('GET /api/v1/media', { query: { q: q || undefined, kind: kind || undefined, usage: usage || undefined, attention: attention ? 'true' : undefined } }),
    placeholderData: keepPreviousData,
  });
  const up = useMediaUpload();

  return (
    <>
      <PageHeader
        title="Медиатека"
        description="Изображения и видео сайта. Файлы, перенесённые со старого сайта, сохраняют свои адреса. Новый или заменённый файл появляется на сайте со следующим релизом — там, где его выбрали в материале."
        crumbs={[{ label: 'Контент' }, { label: 'Медиатека' }]}
      />
      <div className="space-y-4">
        {can('media.upload') ? (
          <Card>
            <div className="space-y-3">
              <UploadZone onFiles={(f) => void up.upload(f)} disabled={up.busy} />
              <UploadList
                items={up.items}
                renderExtra={(i) =>
                  i.id ? (
                    <Link to={`/media/${i.id}`} className="shrink-0 text-xs font-medium text-accent hover:underline">
                      {i.state === 'done' ? 'Открыть' : 'Открыть существующий'}
                    </Link>
                  ) : null
                }
              />
            </div>
          </Card>
        ) : null}

        <Card>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="relative block min-w-56 flex-1">
              <span className="sr-only">Поиск по имени файла</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
              <Input value={q} onChange={(e) => set('q', e.target.value)} placeholder="Поиск по имени файла" className="pl-9" aria-label="Поиск по имени файла" />
            </label>
            <label className="block w-full sm:w-44">
              <span className="sr-only">Вид</span>
              <Select aria-label="Вид" value={kind} onChange={(e) => set('kind', e.target.value)}>
                <option value="">Все виды</option>
                <option value="image">Изображения</option>
                <option value="video">Видео</option>
              </Select>
            </label>
            <label className="block w-full sm:w-52">
              <span className="sr-only">Использование</span>
              <Select aria-label="Использование" value={usage} onChange={(e) => set('usage', e.target.value)}>
                <option value="">Используемые и нет</option>
                <option value="used">Используются</option>
                <option value="unused">Не используются</option>
              </Select>
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={attention} onChange={(e) => set('attention', e.target.checked ? 'true' : '')} className="size-4 accent-accent" />
              Требуют внимания
            </label>
          </div>
          {list.isPending ? (
            <LoadingBlock />
          ) : list.isError ? (
            <Alert tone="danger" action={<Button size="sm" onClick={() => void list.refetch()}>Повторить</Button>}>
              Не удалось загрузить медиатеку.
            </Alert>
          ) : list.data.items.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ink-muted">{q || kind || usage || attention ? 'Файлов с такими условиями нет.' : 'В медиатеке пока нет файлов.'}</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-ink-muted" aria-live="polite">
                {list.data.total} {plural(list.data.total, 'файл', 'файла', 'файлов')}
              </p>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="Файлы медиатеки">
                {list.data.items.map((m) => (
                  <li key={m.id}>
                    <Link to={`/media/${m.id}`} className="group block overflow-hidden rounded-lg border border-line bg-surface hover:border-accent focus-visible:outline-2" data-media-card={m.key}>
                      <MediaThumb item={m} />
                      <span className="block space-y-1 p-2.5">
                        <span className="block truncate text-[13px] font-medium text-ink group-hover:text-accent" title={m.fileName}>
                          {m.fileName}
                        </span>
                        <span className="block truncate text-xs text-ink-muted">
                          {m.kind === 'image' && m.width && m.height ? `${m.width} × ${m.height}` : KIND_LABELS[m.kind]} · {formatBytes(m.bytes)}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {m.usageCount ? (
                            <Badge>{`Используется: ${m.usageCount}`}</Badge>
                          ) : (
                            <Badge tone="accent">Не используется</Badge>
                          )}
                          {m.warnings.length ? (
                            <span className="inline-flex items-center gap-1 text-xs text-warn" title={m.warnings.map((w) => WARNING_LABELS[w]).join('; ')}>
                              <AlertTriangle className="size-3.5" aria-hidden />
                              <span className="sr-only">{m.warnings.map((w) => WARNING_LABELS[w]).join('; ')}</span>
                              {m.warnings.length}
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
