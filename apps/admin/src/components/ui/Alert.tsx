import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cx } from './cx';

type Tone = 'info' | 'ok' | 'warn' | 'danger';
const TONES: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: 'border-info/25 bg-info-soft text-info', Icon: Info },
  ok: { box: 'border-ok/25 bg-ok-soft text-ok', Icon: CheckCircle2 },
  warn: { box: 'border-warn/25 bg-warn-soft text-warn', Icon: AlertTriangle },
  danger: { box: 'border-danger/25 bg-danger-soft text-danger', Icon: XCircle },
};

export function Alert({ tone = 'info', title, children, action, className }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  const { box, Icon } = TONES[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-md border px-3.5 py-3', box, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className="text-[13px] text-ink">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}
