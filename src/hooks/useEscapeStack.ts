/**
 * Shared Escape-key stacking for overlays (lightboxes, modals, the pedagogy
 * drawer). Each active overlay registers its close callback in a module-level
 * stack; on Escape, only the most-recently-opened overlay closes, instead of
 * every overlay's own independent `keydown` listener firing at once.
 */
import { useEffect } from 'react';

const stack: Array<() => void> = [];

export function useEscapeToClose(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return;

    stack.push(onClose);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (stack[stack.length - 1] === onClose) onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      const idx = stack.lastIndexOf(onClose);
      if (idx !== -1) stack.splice(idx, 1);
    };
  }, [active, onClose]);
}
