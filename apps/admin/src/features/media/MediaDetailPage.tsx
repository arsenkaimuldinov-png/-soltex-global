/**
 * One file of the media library (Phase J-1): large preview, facts, where it is used (with links to
 * the editors), «Заменить» (same id: every material keeps showing it) and «Удалить» (only when it
 * is not used).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Film, RefreshCw, Trash2 } from 'lucide-react';
import { api, isApiError, uploadFile } from '../../lib/api/client';
import { formatDateTime } from '../../lib/format';
import { useCan } from '../../lib/session';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { CopyButton } from '../../components/ui/CopyButton';
import { ConfirmDialog } from '../../components/ui/Dialog';
import { Card, Facts, PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { ACCEPT, describeUsage, formatBytes, KIND_LABELS, mediaDetailKey, precheckFile, previewSrc, SOURCE_LABELS, WARNING_LABELS } from './model';
import { uploadErrorMessage } from './upload';

export function MediaDetailPage() {
  const { id = '' } = useParams();
  const can = useCan();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState<{ message: string; existingId?: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const q = useQuery({ queryKey: mediaDetailKey(id), queryFn: () => api('GET /api/v1/media/{id}', { params: { id } }), retry: false });
  const m = q.data;

  const replace = async (file: File) => {
    if (!m) return;
    const pre = precheckFile(file);
    if (pre) return setReplaceError({ message: pre });
    setReplacing(true);
    setReplaceError(null);
    try {
      await uploadFile('POST /api/v1/media/{id}/replace', file, { params: { id: m.id }, query: { name: file.name }, headers: { 'if-match': `"${m.version}"` } });
      toast.success('Файл заменён');
      void qc.invalidateQueries({ queryKey: ['media'] });
      void qc.invalidateQueries({ queryKey: ['content', 'media'] });
    } catch (e) {
      setReplaceError(isApiError(e, 'edit_conflict') ? { message: 'Файл изменил другой пользователь. Обновите страницу.' } : uploadErrorMessage(e));
    } finally {
      setReplacing(false);
    }
  };

  const remove = async () => {
    if (!m) return;
    setDeleting(true);
    try {
      await api('DELETE /api/v1/media/{id}', { params: { id: m.id }, headers: { 'if-match': `"${m.version}"` } });
      toast.success('Файл удалён из медиатеки');
      void qc.invalidateQueries({ queryKey: ['media'] });
      void qc.invalidateQueries({ queryKey: ['content', 'media'] });
      navigate('/media');
    } catch (e) {
      toast.error(e, isApiError(e, 'media_in_use') ? 'Файл используется — удалить нельзя.' : undefined);
      setConfirmDelete(false);
      void q.refetch();
    } finally {
      setDeleting(false);
    }
  };

  if (q.isPending) return <LoadingBlock />;
  if (q.isError || !m)
    return (
      <>
        <PageHeader title="Файл" crumbs={[{ label: 'Медиатека', to: '/media' }]} />
        <Alert tone="danger">{isApiError(q.error, 'not_found') ? 'Файл не найден: возможно, его удалили.' : 'Не удалось загрузить файл.'}</Alert>
      </>
    );

  const used = m.usages.length > 0;
  return (
    <>
      <PageHeader
        title={m.fileName}
        crumbs={[{ label: 'Медиатека', to: '/media' }, { label: m.fileName }]}
        actions={
          <>
            {can('media.replace') ? (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  aria-label="Новый файл для замены"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void replace(f);
                  }}
                />
                <Button icon={<RefreshCw className="size-4" aria-hidden />} loading={replacing} onClick={() => fileInput.current?.click()}>
                  Заменить файл
                </Button>
              </>
            ) : null}
            {can('media.delete') ? (
              <Button variant="danger" icon={<Trash2 className="size-4" aria-hidden />} disabled={used} title={used ? 'Файл используется — сначала выберите другой файл в этих материалах' : undefined} onClick={() => setConfirmDelete(true)}>
                Удалить
              </Button>
            ) : null}
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <Card>
            {m.kind === 'image' ? (
              <img
                src={previewSrc(m, 1200)}
                alt={m.alt ?? ''}
                width={m.width ?? undefined}
                height={m.height ?? undefined}
                style={m.width && m.height ? { aspectRatio: `${m.width} / ${m.height}`, maxWidth: `${m.width}px` } : undefined}
                className="mx-auto block h-auto max-h-[70vh] w-full rounded border border-line bg-subtle object-contain"
                data-media-preview
              />
            ) : (
              <div className="flex aspect-video items-center justify-center rounded bg-subtle text-ink-muted">
                <Film className="size-10" aria-hidden />
                <span className="sr-only">Видео: превью не показывается</span>
              </div>
            )}
          </Card>
          {replaceError ? (
            <Alert tone="danger" action={replaceError.existingId ? <Link to={`/media/${replaceError.existingId}`} className="text-[13px] font-medium text-accent hover:underline">Открыть существующий</Link> : undefined}>
              {replaceError.message}
            </Alert>
          ) : null}
          {m.warnings.length ? (
            <Alert tone="warn">
              <ul className="space-y-0.5">
                {m.warnings.map((w) => (
                  <li key={w}>{WARNING_LABELS[w]}</li>
                ))}
              </ul>
            </Alert>
          ) : null}
        </div>
        <div className="space-y-4">
          <Card title="Где используется" description="Удалить можно только неиспользуемый файл. Замена сохраняет все эти связи.">
            {used ? (
              <ul className="divide-y divide-line text-[13px]" aria-label="Где используется" data-usages>
                {m.usages.map((u, n) => {
                  const d = describeUsage(u);
                  return (
                    <li key={n} className="py-2">
                      {d.to ? (
                        <Link to={d.to} className="font-medium text-ink hover:text-accent hover:underline">
                          {d.title}
                        </Link>
                      ) : (
                        <span className="font-medium">{d.title}</span>
                      )}
                      <span className="block text-xs text-ink-muted">
                        {d.section} · {d.field}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-muted">Нигде не используется.</p>
            )}
          </Card>
          <Card title="О файле">
            <Facts
              items={[
                { label: 'Вид', value: KIND_LABELS[m.kind] },
                { label: 'Размеры', value: m.width && m.height ? `${m.width} × ${m.height} px` : '—' },
                { label: 'Объём', value: formatBytes(m.bytes) },
                { label: 'Формат', value: m.mime ?? '—' },
                { label: 'Откуда', value: SOURCE_LABELS[m.source] ?? m.source },
                { label: 'Изменён', value: `${formatDateTime(m.updatedAt)}${m.updatedBy ? ` · ${m.updatedBy.name}` : ''}` },
                {
                  label: 'Адрес на сайте',
                  value: (
                    <span className="block min-w-0 space-y-1.5">
                      <span className="block font-mono text-xs break-all" dir="ltr" title={m.publicUrl}>
                        {m.src}
                      </span>
                      <CopyButton text={m.publicUrl} label="Копировать адрес" />
                    </span>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Удалить файл?"
        consequences={['Файл исчезнет из медиатеки и из выбора в редакторах.', 'Сохранённая копия останется в резервных копиях; действие записывается в журнал.']}
        confirmLabel="Удалить"
        busy={deleting}
        onConfirm={() => void remove()}
      />
    </>
  );
}
