import { useEffect, useRef } from 'react';

/**
 * Shared behaviour for modal dialogs: Escape closes the dialog, the page behind it does not
 * scroll while it is open, and keyboard focus returns to the control that opened it.
 */
export function useDialog(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (opener && opener.isConnected && opener !== document.body) {
        requestAnimationFrame(() => opener.focus({ preventScroll: true }));
      }
    };
  }, [open]);
}
