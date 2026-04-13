import * as React from 'react';
import { INavNode } from '../../hooks/useNavigation';
import { useNavSearch } from '../../hooks/useNavSearch';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import styles from './CommandPalette.module.scss';

interface ICommandPaletteProps {
  nodes: INavNode[];
  showBadges: boolean;
  onClose: () => void;
}

const newBadgeStyle: React.CSSProperties = {
  fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
  background: 'var(--aahub-primary)', color: '#fff',
};

/**
 * CommandPalette — Cmd+K search overlay.
 * Flat search across all nav items with breadcrumb paths.
 * Arrow key navigation for results with combobox ARIA pattern.
 */
export const CommandPalette: React.FC<ICommandPaletteProps> = ({ nodes, showBadges, onClose }) => {
  const { query, setQuery, results, totalCount } = useNavSearch(nodes);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const modalRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const resultsRef = React.useRef<HTMLUListElement>(null);

  useFocusTrap(modalRef, true);

  // Focus input on mount
  React.useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  // Reset active index when results change
  React.useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  // Scroll active item into view
  React.useEffect(() => {
    if (!resultsRef.current) return;
    const items = resultsRef.current.querySelectorAll<HTMLElement>('[role="option"]');
    const active = items[activeIndex];
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (results[activeIndex]) {
          const url = results[activeIndex].node.Url;
          if (url && url !== '#') {
            window.open(url, results[activeIndex].node.OpenInNewWindow ? '_blank' : '_self');
          }
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [results, activeIndex, onClose]);

  const activeId = results[activeIndex] ? `cp-result-${results[activeIndex].node.Id}` : undefined;

  return (
    <>
      {/* Backdrop */}
      <div className={styles.overlay} onClick={onClose}>
        {/* Modal — stop propagation so clicking inside doesn't close */}
        <div
          ref={modalRef}
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-label="Search navigation"
          onClick={e => e.stopPropagation()}
        >
          {/* Search input */}
          <div className={styles.inputRow}>
            <span className={styles.searchIcon}>&#128269;</span>
            <input
              ref={inputRef}
              className={styles.input}
              type="text"
              placeholder={`Search ${totalCount} navigation items...`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="cp-results"
              aria-activedescendant={activeId}
              autoComplete="off"
            />
            <span className={styles.escHint}>Esc</span>
          </div>

          {/* Results */}
          {query.trim() === '' ? (
            <div className={styles.empty}>
              Type to search across all navigation items...
            </div>
          ) : results.length === 0 ? (
            <div className={styles.empty}>
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <ul
              ref={resultsRef}
              id="cp-results"
              className={styles.results}
              role="listbox"
              aria-label="Search results"
            >
              {results.map((r, i) => {
                const isExternal = r.node.OpenInNewWindow || r.node.IsExternal;
                return (
                  <li
                    key={r.node.Id}
                    id={`cp-result-${r.node.Id}`}
                    className={`${styles.resultItem} ${i === activeIndex ? styles.resultItemActive : ''}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onClick={() => {
                      const url = r.node.Url;
                      if (url && url !== '#') {
                        window.open(url, isExternal ? '_blank' : '_self');
                      }
                      onClose();
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                  >
                    <span className={styles.resultTitle}>
                      {r.node.Icon && <span>{r.node.Icon}</span>}
                      {r.node.Title}
                      {r.node.IsNew && showBadges && <span style={newBadgeStyle}>NEW</span>}
                      {isExternal && <span style={{ fontSize: '0.8em', opacity: 0.4 }}>&#8599;</span>}
                    </span>
                    {r.breadcrumb && (
                      <span className={styles.resultBreadcrumb}>{r.breadcrumb}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Status bar */}
          <div className={styles.status}>
            <span>{results.length > 0 ? `${results.length} result${results.length !== 1 ? 's' : ''}` : ''}</span>
            <span>&#8593;&#8595; Navigate &middot; &#9166; Open &middot; Esc Close</span>
          </div>

          {/* Live region for screen readers */}
          <div role="status" aria-live="polite" style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            {query.trim() && `${results.length} result${results.length !== 1 ? 's' : ''} found`}
          </div>
        </div>
      </div>
    </>
  );
};
