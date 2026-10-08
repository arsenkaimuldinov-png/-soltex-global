/**
 * Unsaved changes → warning when leaving the page (review §X): in-app navigation is blocked with a
 * confirmation, closing or reloading the tab triggers the browser prompt.
 */
import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

export const UNSAVED_MESSAGE = 'Есть несохранённые изменения. Уйти со страницы и потерять их?';

export function useUnsavedChangesGuard(dirty: boolean) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm(UNSAVED_MESSAGE)) blocker.proceed();
    else blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}
