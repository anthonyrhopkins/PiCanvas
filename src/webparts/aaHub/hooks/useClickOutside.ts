import * as React from 'react';

/**
 * Calls handler when a mousedown/touchstart occurs outside all provided refs.
 * Used to dismiss mega panels, drawers, and palettes.
 */
export function useClickOutside(
  refs: React.RefObject<HTMLElement>[],
  handler: () => void,
  active: boolean
): void {
  React.useEffect(() => {
    if (!active) return;

    const listener = (e: MouseEvent | TouchEvent): void => {
      const target = e.target as Node;
      for (const ref of refs) {
        if (ref.current && ref.current.contains(target)) return;
      }
      handler();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [refs, handler, active]);
}
