import { cx } from './cx';

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? 'status' : undefined} className="inline-flex items-center gap-2">
      <svg className={cx('animate-spin', className ?? 'size-4')} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label ? <span className="text-ink-muted">{label}</span> : null}
    </span>
  );
}

/** Full-area loading state. */
export function LoadingBlock({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center text-ink-muted">
      <Spinner className="size-5" label={label} />
    </div>
  );
}
