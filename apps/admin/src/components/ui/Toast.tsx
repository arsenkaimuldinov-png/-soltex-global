/**
 * Toasts (Radix). Error toasts carry the request id (approved §19: «Код ошибки: 7f3c…, сообщите
 * администратору»), so a user can quote it and an admin can find the log line and audit event.
 */
import * as RadixToast from '@radix-ui/react-toast';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { describeError } from '../../lib/errors';
import { shortId } from '../../lib/format';
import { cx } from './cx';

interface ToastItem {
  id: number;
  tone: 'ok' | 'danger';
  title: string;
  requestId?: string | null;
}

interface ToastApi {
  success: (title: string) => void;
  error: (error: unknown, fallback?: string) => void;
}

const Ctx = createContext<ToastApi | null>(null);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, 'id'>) => setItems((list) => [...list.slice(-3), { ...t, id: ++seq }]), []);
  const api = useMemo<ToastApi>(
    () => ({
      success: (title) => push({ tone: 'ok', title }),
      error: (error, fallback) => {
        const d = describeError(error, fallback);
        if (d.silent) return;
        push({ tone: 'danger', title: d.message, requestId: d.requestId });
      },
    }),
    [push]
  );

  return (
    <Ctx.Provider value={api}>
      <RadixToast.Provider swipeDirection="right" duration={6000} label="Уведомление">
        {children}
        {items.map((t) => (
          <RadixToast.Root
            key={t.id}
            type={t.tone === 'danger' ? 'foreground' : 'background'}
            duration={t.tone === 'danger' ? 10000 : 5000}
            onOpenChange={(open) => {
              if (!open) setItems((list) => list.filter((x) => x.id !== t.id));
            }}
            className={cx('flex items-start gap-3 rounded-lg border bg-surface px-4 py-3 shadow-lg', t.tone === 'danger' ? 'border-danger/30' : 'border-ok/30')}
          >
            {t.tone === 'danger' ? <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />}
            <div className="min-w-0 flex-1">
              <RadixToast.Title className="text-[13px] font-medium text-ink">{t.title}</RadixToast.Title>
              {t.requestId ? (
                <RadixToast.Description className="mt-1 text-xs text-ink-muted">
                  Код ошибки: <span className="font-mono">{shortId(t.requestId)}</span>, сообщите администратору.
                </RadixToast.Description>
              ) : null}
            </div>
            <RadixToast.Close className="rounded p-0.5 text-ink-muted hover:text-ink" aria-label="Закрыть уведомление">
              <X className="size-3.5" aria-hidden />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none" />
      </RadixToast.Provider>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast outside ToastProvider');
  return ctx;
}
