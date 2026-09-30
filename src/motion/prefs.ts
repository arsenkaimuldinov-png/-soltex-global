/**
 * Motion preferences, applied as classes on <html> before the first render:
 *  - "motion-ready": reveal primitives may start hidden (never set with prefers-reduced-motion)
 *  - "vt":           the browser supports View Transitions, so route changes cross-fade natively
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function supportsViewTransitions(): boolean {
  return typeof document !== 'undefined' && typeof (document as Document & { startViewTransition?: unknown }).startViewTransition === 'function';
}

export function applyMotionClasses(): void {
  const root = document.documentElement;
  const sync = () => {
    const reduced = prefersReducedMotion();
    root.classList.toggle('motion-ready', !reduced);
    root.classList.toggle('vt', !reduced && supportsViewTransitions());
  };
  sync();
  window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', sync);
}

/**
 * Run a DOM update inside a View Transition when available (and motion is allowed);
 * otherwise run it directly. `update` must commit synchronously (use flushSync).
 */
export function withViewTransition(update: () => void): void {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (!doc.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  doc.startViewTransition(update);
}
