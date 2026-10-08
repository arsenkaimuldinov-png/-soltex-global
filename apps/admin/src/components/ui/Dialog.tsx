/**
 * Dialogs on Radix primitives (focus trap, Esc, aria). ConfirmDialog states the consequences of a
 * destructive action before it runs (review §X).
 */
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import * as RadixDialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { cx } from './cx';

const overlay = 'fixed inset-0 z-40 bg-ink/35';
const panel =
  'fixed top-1/2 left-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-line bg-surface shadow-xl focus:outline-none';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Prevent closing by Esc/outside click while something important is shown (e.g. recovery codes). */
  modalLock?: boolean;
}

const WIDTH = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

export function Dialog({ open, onOpenChange, title, description, children, footer, size = 'md', modalLock }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={overlay} />
        <RadixDialog.Content
          className={cx(panel, WIDTH[size])}
          onEscapeKeyDown={modalLock ? (e) => e.preventDefault() : undefined}
          onPointerDownOutside={modalLock ? (e) => e.preventDefault() : undefined}
          aria-describedby={description ? undefined : undefined}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <RadixDialog.Title className="text-base font-semibold text-ink">{title}</RadixDialog.Title>
              {description ? <RadixDialog.Description className="mt-1 text-[13px] text-ink-muted">{description}</RadixDialog.Description> : null}
            </div>
            {modalLock ? null : (
              <RadixDialog.Close className="rounded p-1 text-ink-muted hover:bg-subtle hover:text-ink" aria-label="Закрыть">
                <X className="size-4" aria-hidden />
              </RadixDialog.Close>
            )}
          </div>
          <div className="px-5 py-4">{children}</div>
          {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-subtle/60 px-5 py-3">{footer}</div> : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will happen, in plain words. */
  consequences: ReactNode[];
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
  destructive?: boolean;
}

export function ConfirmDialog({ open, onOpenChange, title, consequences, confirmLabel, onConfirm, busy, destructive = true }: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlay} />
        <AlertDialog.Content className={cx(panel, 'max-w-md')}>
          <div className="space-y-3 px-5 py-4">
            <AlertDialog.Title className="text-base font-semibold text-ink">{title}</AlertDialog.Title>
            <AlertDialog.Description asChild>
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink">
                {consequences.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </AlertDialog.Description>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-subtle/60 px-5 py-3">
            <AlertDialog.Cancel asChild>
              <Button disabled={busy}>Отмена</Button>
            </AlertDialog.Cancel>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              loading={busy}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
