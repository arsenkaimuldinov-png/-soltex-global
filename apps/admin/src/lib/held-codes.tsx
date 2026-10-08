/**
 * Recovery codes returned by the API with the first factor must be shown before the user moves on.
 * While they are held (memory only), the enrollment route does not redirect away.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface Held {
  codes: string[] | null;
  hold: (codes: string[]) => void;
  release: () => void;
}
const Ctx = createContext<Held | null>(null);

export function HeldCodesProvider({ children }: { children: ReactNode }) {
  const [codes, setCodes] = useState<string[] | null>(null);
  const value = useMemo<Held>(() => ({ codes, hold: setCodes, release: () => setCodes(null) }), [codes]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHeldCodes(): Held {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useHeldCodes outside HeldCodesProvider');
  return ctx;
}
