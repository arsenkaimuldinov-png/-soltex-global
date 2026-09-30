import { useEffect, useRef, useState } from 'react';

/**
 * Keeps the last non-null value mounted for `ms` after it becomes null, so dialogs can play
 * an exit transition. `exiting` is true during that window.
 */
export function usePresence<T>(value: T | null | undefined | false, ms = 230): { item: T | null; exiting: boolean } {
  const [item, setItem] = useState<T | null>(value || null);
  const [exiting, setExiting] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(timer.current);
    if (value) {
      setItem(value);
      setExiting(false);
      return;
    }
    if (!item) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setItem(null);
      return;
    }
    setExiting(true);
    timer.current = window.setTimeout(() => {
      setItem(null);
      setExiting(false);
    }, ms);
    return () => window.clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return { item, exiting };
}
