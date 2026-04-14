import * as React from 'react';
import { INavNode } from '../../hooks/useNavigation';
import { useClickOutside } from '../../hooks/useClickOutside';
import styles from './NavBarDesktop.module.scss';

interface INavBarDesktopProps {
  nodes: INavNode[];
  activeCategory: number | null;
  onCategoryClick: (id: number | null) => void;
  onSearchClick: () => void;
  showBadges: boolean;
}

/**
 * NavBarDesktop — Horizontal nav bar with cascading flyout dropdowns.
 * Matches the original aahub-home-sap.html SAP Horizon Dark aesthetic.
 * Click-to-open top level, hover-to-open flyout submenus.
 * Priority+ pattern: items that don't fit overflow into "More ▼".
 */
export const NavBarDesktop: React.FC<INavBarDesktopProps> = ({
  nodes,
  activeCategory,
  onCategoryClick,
  onSearchClick,
  showBadges,
}) => {
  const barRef = React.useRef<HTMLDivElement>(null);
  const navRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLDivElement>(null);

  // Priority+ overflow: measure which items fit using a hidden measurement row
  const [visibleCount, setVisibleCount] = React.useState(nodes.length);

  // Pre-compute item widths from the hidden measurement row (always has ALL items)
  const itemWidthsRef = React.useRef<number[]>([]);

  React.useEffect(() => {
    // Measure all items from the hidden row on mount / node change
    if (!measureRef.current) return;
    const items = measureRef.current.querySelectorAll<HTMLElement>('[data-measure-item]');
    itemWidthsRef.current = Array.from(items).map(el => el.offsetWidth);
  }, [nodes]);

  React.useEffect(() => {
    const measure = (): void => {
      if (!barRef.current || itemWidthsRef.current.length === 0) return;
      const barWidth = barRef.current.offsetWidth;
      // Reserve space for search trigger (~100px) and "More" button (~80px)
      const available = barWidth - 180;
      let total = 0;
      let count = 0;
      for (let i = 0; i < itemWidthsRef.current.length; i++) {
        total += itemWidthsRef.current[i];
        if (total <= available) count = i + 1;
        else break;
      }
      setVisibleCount(Math.max(3, Math.min(count, nodes.length)));
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [nodes]);

  // Close dropdown on click outside
  useClickOutside(
    [navRef],
    () => onCategoryClick(null),
    activeCategory !== null
  );

  // Split into visible + overflow
  const visibleNodes = nodes.slice(0, visibleCount);
  const overflowNodes = nodes.slice(visibleCount);

  // Split visible: first 5 left, rest right (with separator)
  const leftNodes = visibleNodes.slice(0, Math.min(5, visibleNodes.length));
  const rightNodes = visibleNodes.slice(5);

  return (
    <div ref={barRef} className={styles.bar}>
      {/* Hidden measurement row — always renders ALL items to measure widths */}
      <div
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: 'absolute', visibility: 'hidden', height: 0, overflow: 'hidden',
          display: 'flex', whiteSpace: 'nowrap', pointerEvents: 'none',
        }}
      >
        {nodes.map(node => (
          <span key={node.Id} data-measure-item style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '0 10px', fontSize: '13px', fontWeight: 500 }}>
            {node.Title}
            {node.Children && node.Children.length > 0 && <span style={{ fontSize: '0.7em' }}>&#9660;</span>}
          </span>
        ))}
      </div>

      <div ref={navRef} style={{ display: 'flex', alignItems: 'stretch' }}>
        {leftNodes.map(node => (
          <CategoryItem
            key={node.Id}
            node={node}
            isActive={activeCategory === node.Id}
            onClick={() => onCategoryClick(activeCategory === node.Id ? null : node.Id)}
            showBadges={showBadges}
          />
        ))}

        {rightNodes.length > 0 && <div className={styles.separator} />}

        {rightNodes.map(node => (
          <CategoryItem
            key={node.Id}
            node={node}
            isActive={activeCategory === node.Id}
            onClick={() => onCategoryClick(activeCategory === node.Id ? null : node.Id)}
            showBadges={showBadges}
            alignRight
          />
        ))}

        {/* Priority+ "More" overflow */}
        {overflowNodes.length > 0 && (
          <MoreDropdown
            nodes={overflowNodes}
            activeCategory={activeCategory}
            onCategoryClick={onCategoryClick}
            showBadges={showBadges}
          />
        )}
      </div>

      {/* Search trigger */}
      <button
        className={styles.searchTrigger}
        onClick={onSearchClick}
        aria-label="Search navigation (Ctrl+K)"
        title="Search navigation (Ctrl+K)"
      >
        &#128269; <span className={styles.searchHint}>Ctrl+K</span>
      </button>
    </div>
  );
};

// ── CategoryItem (top-level) ──

interface ICategoryItemProps {
  node: INavNode;
  isActive: boolean;
  onClick: () => void;
  showBadges: boolean;
  alignRight?: boolean;
}

const CategoryItem: React.FC<ICategoryItemProps> = ({ node, isActive, onClick, showBadges, alignRight }) => {
  const hasChildren = node.Children && node.Children.length > 0;

  return (
    <div className={styles.navItem} data-nav-item>
      <button
        className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
        onClick={onClick}
        aria-expanded={isActive}
        aria-haspopup={hasChildren ? 'true' : undefined}
      >
        {node.Icon && <span>{node.Icon}</span>}
        {node.Title}
        {node.IsNew && showBadges && <span className={styles.newBadge}>NEW</span>}
        {hasChildren && (
          <span className={`${styles.arrow} ${isActive ? styles.arrowOpen : ''}`}>&#9660;</span>
        )}
      </button>

      {hasChildren && isActive && (
        <div className={`${styles.dropdown} ${alignRight ? styles.dropdownRight : ''}`}>
          {node.Children.map(child => (
            <DropdownItem key={child.Id} node={child} showBadges={showBadges} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── DropdownItem (level 2+, recursive with flyout submenus) ──

interface IDropdownItemProps {
  node: INavNode;
  showBadges: boolean;
}

const DropdownItem: React.FC<IDropdownItemProps> = ({ node, showBadges }) => {
  const hasChildren = node.Children && node.Children.length > 0;
  const isExternal = node.OpenInNewWindow || node.IsExternal;

  if (!hasChildren) {
    return (
      <a
        className={styles.dropdownLink}
        href={node.Url || '#'}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
      >
        {node.Title}
        {node.IsNew && showBadges && <span className={styles.newBadge}>NEW</span>}
      </a>
    );
  }

  // Has children → render as flyout submenu trigger
  return (
    <div className={styles.hasSub}>
      <a
        className={styles.dropdownLink}
        href={node.Url || '#'}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
      >
        {node.Title}
        {node.IsNew && showBadges && <span className={styles.newBadge}>NEW</span>}
      </a>
      <div className={styles.submenu}>
        {node.Children.map(child => (
          <DropdownItem key={child.Id} node={child} showBadges={showBadges} />
        ))}
      </div>
    </div>
  );
};

// ── More Dropdown (Priority+ overflow) ──

interface IMoreDropdownProps {
  nodes: INavNode[];
  activeCategory: number | null;
  onCategoryClick: (id: number | null) => void;
  showBadges: boolean;
}

const MoreDropdown: React.FC<IMoreDropdownProps> = ({ nodes, activeCategory, onCategoryClick, showBadges }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  useClickOutside([ref], () => setOpen(false), open);

  return (
    <div className={styles.navItem} ref={ref}>
      <button
        className={`${styles.navLink} ${open ? styles.navLinkActive : ''}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        More <span className={`${styles.arrow} ${open ? styles.arrowOpen : ''}`}>&#9660;</span>
      </button>

      {open && (
        <div className={`${styles.dropdown} ${styles.dropdownRight}`}>
          {nodes.map(node => {
            const hasChildren = node.Children && node.Children.length > 0;
            if (!hasChildren) {
              return (
                <a key={node.Id} className={styles.dropdownLink} href={node.Url || '#'} target="_blank" rel="noopener noreferrer">
                  {node.Title}
                </a>
              );
            }
            return (
              <div key={node.Id} className={styles.hasSub}>
                <button
                  className={styles.dropdownLink}
                  onClick={() => {
                    setOpen(false);
                    onCategoryClick(activeCategory === node.Id ? null : node.Id);
                  }}
                >
                  {node.Title}
                  {node.IsNew && showBadges && <span className={styles.newBadge}>NEW</span>}
                </button>
                <div className={styles.submenu}>
                  {node.Children.map(child => (
                    <DropdownItem key={child.Id} node={child} showBadges={showBadges} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
