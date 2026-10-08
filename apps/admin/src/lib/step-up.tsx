/**
 * Step-up re-authentication (approved §7): sensitive actions need a second factor verified in
 * the last 10 minutes. `withStepUp(action)` runs the action; if the API answers
 * `step_up_required`, it asks for a passkey or an authenticator code and retries once.
 */
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { isApiError } from './api/client';
import { Cancelled } from './errors';
import { SESSION_KEY } from './session';
import { StepUpDialog } from '../features/auth/StepUpDialog';

type WithStepUp = <T>(action: () => Promise<T>) => Promise<T>;
const Ctx = createContext<WithStepUp | null>(null);

export function StepUpProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const pending = useRef<{ resolve: () => void; reject: (e: unknown) => void } | null>(null);

  const ask = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        pending.current = { resolve, reject };
        setOpen(true);
      }),
    []
  );

  const withStepUp = useCallback<WithStepUp>(
    async (action) => {
      try {
        return await action();
      } catch (e) {
        if (!isApiError(e, 'step_up_required')) throw e;
        await ask();
        return action();
      }
    },
    [ask]
  );

  return (
    <Ctx.Provider value={withStepUp}>
      {children}
      <StepUpDialog
        open={open}
        onVerified={() => {
          setOpen(false);
          void qc.invalidateQueries({ queryKey: SESSION_KEY });
          pending.current?.resolve();
          pending.current = null;
        }}
        onCancel={() => {
          setOpen(false);
          pending.current?.reject(new Cancelled());
          pending.current = null;
        }}
      />
    </Ctx.Provider>
  );
}

export function useStepUp(): WithStepUp {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStepUp outside StepUpProvider');
  return ctx;
}
