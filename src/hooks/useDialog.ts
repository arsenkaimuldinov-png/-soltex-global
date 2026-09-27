import { useEffect } from 'react';

/**
 * Shared behaviour for modal dialogs: Escape closes the dialog and the page behind it
 * does not scroll while it is open. Visual design of each dialog is unchanged.
 */
export function useDialog(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);
}
