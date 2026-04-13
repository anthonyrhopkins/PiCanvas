import * as React from 'react';
import { INavNode } from '../../hooks/useNavigation';
import styles from './MegaMenu.module.scss';

interface IMegaMenuProps {
  nodes: INavNode[];
  loading: boolean;
  showBadges: boolean;
  onGearClick?: () => void;
}

/**
 * MegaMenu — 3-level hover-based navigation bar.
 * Renders INavNode[] tree as a horizontal nav with flyout submenus.
 * Supports mobile hamburger, NEW badges, icons, and keyboard nav.
 */
export const MegaMenu: React.FC<IMegaMenuProps> = ({ nodes, loading, showBadges, onGearClick }) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  if (loading) {
    return (
      <nav className={styles.nav} aria-label="Main navigation">
        <div className={styles.loading}>Loading navigation...</div>
      </nav>
    );
  }

  // Split nodes: first 5 left-aligned, rest right-aligned
  const leftNodes = nodes.slice(0, 5);
  const rightNodes = nodes.slice(5);

  return (
    <nav className={styles.nav} aria-label="Main navigation">
      {/* Mobile hamburger */}
      <button
        className={styles.mobileBtn}
        onClick={() => setMobileOpen(prev => !prev)}
        aria-label="Toggle menu"
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? '\u2715' : '\u2630'}
      </button>

      <div className={`${styles.navInner} ${mobileOpen ? styles.mobileOpen : ''}`}>
        {/* Gear/settings button */}
        {onGearClick && (
          <div className={styles.navItem}>
            <button
              className={styles.navLink}
              onClick={onGearClick}
              aria-label="Settings"
              title="Settings"
              style={{ fontSize: '1.2em', padding: '0 8px', color: 'var(--aahub-accent)' }}
            >
              &#9881;
            </button>
          </div>
        )}

        {/* Left-aligned nav items */}
        {leftNodes.map(node => (
          <NavItem key={node.Id} node={node} showBadges={showBadges} />
        ))}

        {/* Separator before right-aligned items */}
        {rightNodes.length > 0 && <div className={styles.separator} />}

        {/* Right-aligned nav items */}
        {rightNodes.map(node => (
          <NavItem key={node.Id} node={node} showBadges={showBadges} alignRight />
        ))}
      </div>
    </nav>
  );
};

// ── NavItem (top-level) ──

interface INavItemProps {
  node: INavNode;
  showBadges: boolean;
  alignRight?: boolean;
}

const NavItem: React.FC<INavItemProps> = ({ node, showBadges, alignRight }) => {
  const hasChildren = node.Children && node.Children.length > 0;

  // If no children and has a URL, render as direct link
  if (!hasChildren && node.Url && node.Url !== '#') {
    return (
      <div className={styles.navItem}>
        <a
          className={styles.navLink}
          href={node.Url}
          target={node.OpenInNewWindow ? '_blank' : undefined}
          rel={node.OpenInNewWindow ? 'noopener noreferrer' : undefined}
        >
          {node.Icon && <span className={styles.dropdownIcon}>{node.Icon}</span>}
          {!node.IconOnly && node.Title}
          {node.IsNew && showBadges && <span className={styles.newBadge}>NEW</span>}
        </a>
      </div>
    );
  }

  return (
    <div className={styles.navItem}>
      <a className={styles.navLink} href={node.Url || '#'} role="button" aria-haspopup="true">
        {node.Icon && <span className={styles.dropdownIcon}>{node.Icon}</span>}
        {!node.IconOnly && node.Title}
        {node.IsNew && showBadges && <span className={styles.newBadge}>NEW</span>}
        {hasChildren && <span className={styles.arrow}>&#9660;</span>}
      </a>

      {hasChildren && (
        <div className={`${styles.dropdown} ${alignRight ? styles.alignRight : ''}`}>
          {node.Children.map(child => (
            <DropdownItem key={child.Id} node={child} showBadges={showBadges} />
          ))}
        </div>
      )}
    </div>
  );
};

// ── DropdownItem (level 2+, recursive) ──

interface IDropdownItemProps {
  node: INavNode;
  showBadges: boolean;
}

const DropdownItem: React.FC<IDropdownItemProps> = ({ node, showBadges }) => {
  const hasChildren = node.Children && node.Children.length > 0;

  if (!hasChildren) {
    return (
      <a
        className={styles.dropdownLink}
        href={node.Url || '#'}
        target={node.OpenInNewWindow ? '_blank' : undefined}
        rel={node.OpenInNewWindow ? 'noopener noreferrer' : undefined}
      >
        {node.Icon && <span className={styles.dropdownIcon}>{node.Icon}</span>}
        {node.Title}
        {node.IsNew && showBadges && <span className={styles.newBadge}>NEW</span>}
      </a>
    );
  }

  // Has children: render as submenu trigger
  return (
    <div className={styles.hasSub}>
      <a
        className={styles.dropdownLink}
        href={node.Url || '#'}
        target={node.OpenInNewWindow ? '_blank' : undefined}
        rel={node.OpenInNewWindow ? 'noopener noreferrer' : undefined}
      >
        {node.Icon && <span className={styles.dropdownIcon}>{node.Icon}</span>}
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
