import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cx } from './cx';

export interface Crumb {
  label: string;
  to?: string;
}

/** Page title, breadcrumbs and actions (review §X: breadcrumbs). */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Soltex Admin`;
  }, [title]);
}

export function PageHeader({ title, description, crumbs, actions }: { title: string; description?: ReactNode; crumbs?: Crumb[]; actions?: ReactNode }) {
  useDocumentTitle(title);
  return (
    <header className="mb-6 space-y-2">
      {crumbs?.length ? (
        <nav aria-label="Навигационная цепочка">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
            {crumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="size-3" aria-hidden /> : null}
                {c.to ? (
                  <Link to={c.to} className="hover:text-ink hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page">{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {description ? <p className="max-w-3xl text-[13px] text-ink-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Card({ title, description, actions, children, className }: { title?: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-lg border border-line bg-surface', className)} aria-label={title}>
      {title ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/** Empty state with the next step (review §X). */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children ? <div className="max-w-md text-[13px] text-ink-muted">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Definition list for key/value facts. */
export function Facts({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[minmax(10rem,auto)_1fr]">
      {items.map((it) => (
        <div key={it.label} className="contents">
          <dt className="text-[13px] text-ink-muted">{it.label}</dt>
          <dd className="text-[13px] text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Kbd({ children }: { children: string }) {
  return <kbd className="rounded border border-line-strong bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-ink-muted">{children}</kbd>;
}
