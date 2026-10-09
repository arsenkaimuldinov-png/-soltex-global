/**
 * Unsaved changes → warning when leaving the page (review §X). In-app navigation is held and the
 * admin's own confirmation dialog asks first (no browser confirm()); closing or reloading the tab
 * triggers the browser's own prompt, which is the only option there.
 *
 *   const guard = useUnsavedChangesGuard(isDirty);
 *   return <>{form}{guard}</>;
 */
import { useEffect, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';
import { ConfirmDialog } from '../components/ui/Dialog';

export const UNSAVED_TITLE = 'Уйти без сохранения?';

export function useUnsavedChangesGuard(dirty: boolean): ReactNode {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') blocker.reset();
      }}
      title={UNSAVED_TITLE}
      consequences={['Есть несохранённые изменения.', 'Если уйти со страницы, они будут потеряны.']}
      confirmLabel="Уйти без сохранения"
      onConfirm={() => blocker.state === 'blocked' && blocker.proceed()}
    />
  );
}
