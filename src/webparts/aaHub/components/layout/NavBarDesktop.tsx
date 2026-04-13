import * as React from 'react';
import { INavNode } from '../../hooks/useNavigation';
import styles from './NavBarDesktop.module.scss';

interface INavBarDesktopProps {
  nodes: INavNode[];
  activeCategory: number | null;
  onCategoryClick: (id: number | null) => void;
  onSearchClick: () => void;
  showBadges: boolean;
}

/**
 * NavBarDesktop — Horizontal category bar with click-to-toggle mega panels.
 * Implements roving tabindex for Left/Right arrow keyboard navigation.
 */
export const NavBarDesktop: React.FC<INavBarDesktopProps> = ({
  nodes,
  activeCategory,
  onCategoryClick,
  onSearchClick,
  showBadges,
}) => {
  const [focusIndex, setFocusIndex] = React.useState(0);
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Focus the button at focusIndex when it changes via keyboard
  React.useEffect(() => {
    const btn = buttonRefs.current[focusIndex];
    if (btn && document.activeElement && buttonRefs.current.includes(document.activeElement as HTMLButtonElement)) {
      btn.focus();
    }
  }, [focusIndex]);

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    const count = nodes.length;
    if (count === 0) return;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        setFocusIndex(prev => (prev + 1) % count);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        setFocusIndex(prev => (prev - 1 + count) % count);
        break;
      case 'Home':
        e.preventDefault();
        setFocusIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setFocusIndex(count - 1);
        break;
      case 'Escape':
        if (activeCategory !== null) {
          e.preventDefault();
          onCategoryClick(null);
        }
        break;
    }
  }, [nodes.length, activeCategory, onCategoryClick]);

  // Split: first 5 left, rest right (with separator)
  const leftNodes = nodes.slice(0, 5);
  const rightNodes = nodes.slice(5);

  let globalIndex = 0;

  const renderButton = (node: INavNode): React.ReactElement => {
    const idx = globalIndex++;
    const isActive = activeCategory === node.Id;

    return (
      <button
        key={node.Id}
        ref={el => { buttonRefs.current[idx] = el; }}
        className={`${styles.category} ${isActive ? styles.categoryActive : ''}`}
        onClick={() => onCategoryClick(isActive ? null : node.Id)}
        onKeyDown={handleKeyDown}
        tabIndex={idx === focusIndex ? 0 : -1}
        aria-expanded={isActive}
        aria-haspopup="true"
        aria-controls={isActive ? `mega-panel-${node.Id}` : undefined}
      >
        {node.Icon && <span>{node.Icon}</span>}
        {node.Title}
        {node.IsNew && showBadges && (
          <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'var(--aahub-primary)', color: '#fff', marginLeft: '4px' }}>NEW</span>
        )}
        <span className={`${styles.chevron} ${isActive ? styles.chevronOpen : ''}`}>&#9660;</span>
      </button>
    );
  };

  return (
    <div className={styles.bar} role="menubar" aria-label="Category navigation">
      {leftNodes.map(renderButton)}
      {rightNodes.length > 0 && <div className={styles.separator} />}
      {rightNodes.map(renderButton)}

      {/* Search trigger */}
      <button
        className={styles.searchTrigger}
        onClick={onSearchClick}
        aria-label="Search navigation"
        title="Search navigation (Ctrl+K)"
      >
        <span className={styles.searchIcon}>&#128269;</span>
        <span className={styles.searchHint}>Ctrl+K</span>
      </button>
    </div>
  );
};
