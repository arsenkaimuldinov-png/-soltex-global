/**
 * «Публикация · Ревизии · <запись>»: the full revision history of one record (all versions, paged),
 * with the same view / compare / restore actions as the panel in the editor.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api/client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { PageHeader } from '../../components/ui/Layout';
import { LoadingBlock } from '../../components/ui/Spinner';
import { NotFoundPage } from '../../app/ErrorPages';
import { TRANSLATABLE_TYPES, TYPE_LABELS, type TranslatableType } from '../translations/model';
import { HistoryPanel } from './HistoryPanel';
import { editorPath, pageName } from './model';

interface RecordHead {
  id: string;
  key: string;
  status: string;
  version: number;
  pageKey?: string;
  fields?: Record<string, unknown>;
}

export function HistoryPage() {
  const { type = '', id = '' } = useParams();
  if (!(TRANSLATABLE_TYPES as readonly string[]).includes(type)) return <NotFoundPage />;
  return <History key={`${type}/${id}`} type={type as TranslatableType} id={id} />;
}

function History({ type, id }: { type: TranslatableType; id: string }) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['content', type, 'record', id],
    queryFn: () => api(`GET /api/v1/content/${type}/{id}` as 'GET /api/v1/content/projects/{id}', { params: { id } }) as Promise<unknown> as Promise<RecordHead>,
    retry: false,
  });
  const record = query.data;
  const title = record ? (type === 'pages' ? pageName(record.pageKey ?? record.key) : String(record.fields?.title ?? record.key)) : 'История';

  return (
    <>
      <PageHeader
        title={title}
        description={`История изменений · ${TYPE_LABELS[type]}`}
        crumbs={[{ label: 'Публикация', to: '/publishing' }, { label: 'Ревизии', to: '/publishing/revisions' }, { label: title }]}
        actions={
          record ? (
            <Link to={editorPath(type, id)} className="text-[13px] font-medium text-accent hover:underline">
              Открыть в редакторе
            </Link>
          ) : undefined
        }
      />
      {query.isPending ? (
        <LoadingBlock />
      ) : query.isError || !record ? (
        <Alert tone="danger" action={<Button size="sm" onClick={() => void query.refetch()}>Повторить</Button>}>
          Не удалось загрузить запись.
        </Alert>
      ) : (
        <HistoryPanel
          type={type}
          id={id}
          entityVersion={record.version}
          archived={record.status === 'archived'}
          pageSize={25}
          full
          onRestored={() => void qc.invalidateQueries({ queryKey: ['content', type] })}
        />
      )}
    </>
  );
}
