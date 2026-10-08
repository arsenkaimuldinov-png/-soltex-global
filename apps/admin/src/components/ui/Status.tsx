import { cx } from './cx';

type Tone = 'ok' | 'warn' | 'danger' | 'neutral' | 'info';
const DOT: Record<Tone, string> = { ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger', neutral: 'bg-ink-faint', info: 'bg-info' };

/** Status as dot + text, never color alone (review §X). */
export function Status({ tone, children, className }: { tone: Tone; children: string; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      <span className={cx('size-2 shrink-0 rounded-full', DOT[tone])} aria-hidden />
      <span>{children}</span>
    </span>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: string; tone?: 'neutral' | 'accent' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap',
        tone === 'accent' ? 'border-accent/20 bg-accent-soft text-accent' : 'border-line bg-subtle text-ink-muted'
      )}
    >
      {children}
    </span>
  );
}
