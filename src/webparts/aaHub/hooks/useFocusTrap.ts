import * as React from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab/Shift+Tab focus within a container element.
 * Stores the previously focused element and restores it on deactivation.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  active: boolean
): void {
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  // Store and restore focus
  React.useEffect(() => {
    if (active) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Move focus into container on next tick (after render)
      const timer = setTimeout(() => {
        if (!containerRef.current) return;
        const first = containerRef.current.querySelector<HTMLElement>(FOCUSABLE);
        if (first) first.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
    return undefined;
  }, [active, containerRef]);

  // Trap Tab key
  React.useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab' || !containerRef.current) return;

      const focusable = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active, containerRef]);
}
