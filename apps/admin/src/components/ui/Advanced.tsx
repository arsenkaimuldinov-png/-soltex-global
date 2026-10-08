/**
 * «Дополнительно» (approved §16): technical details (IDs, request IDs, raw values) are kept out of
 * the main UI, collapsed, and shown only to Owner and Admin. This is a presentation rule only; the
 * API decides what data a role may read.
 */
import * as Collapsible from '@radix-ui/react-collapsible';
import { useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { useSessionView } from '../../lib/session';
import { cx } from './cx';

export const TECHNICAL_DETAILS_ROLES = ['owner', 'admin'] as const;

export function useShowsTechnicalDetails(): boolean {
  const { user } = useSessionView();
  return (TECHNICAL_DETAILS_ROLES as readonly string[]).includes(user.role);
}

export function Advanced({ children, className }: { children: ReactNode; className?: string }) {
  const visible = useShowsTechnicalDetails();
  const [open, setOpen] = useState(false);
  if (!visible) return null;
  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className={cx('text-[13px]', className)}>
      <Collapsible.Trigger className="inline-flex items-center gap-1 rounded text-ink-muted hover:text-ink">
        <ChevronRight className={cx('size-3.5 transition-transform', open && 'rotate-90')} aria-hidden />
        Дополнительно
      </Collapsible.Trigger>
      <Collapsible.Content className="mt-2 rounded-md border border-line bg-subtle px-3 py-2.5">{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}

/** One technical value with a monospace rendering. */
export function TechValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 py-0.5">
      <span className="text-ink-muted">{label}:</span>
      <span className="font-mono text-xs break-all text-ink">{value ?? '—'}</span>
    </div>
  );
}
