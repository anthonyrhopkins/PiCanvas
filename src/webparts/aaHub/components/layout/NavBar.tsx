import * as React from 'react';
import { INavNode } from '../../hooks/useNavigation';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useClickOutside } from '../../hooks/useClickOutside';
import { NavBarDesktop } from './NavBarDesktop';
import { MegaPanel } from './MegaPanel';
import styles from './NavBar.module.scss';

import { NavBarMobile } from './NavBarMobile';
import { CommandPalette } from './CommandPalette';

interface INavBarProps {
  nodes: INavNode[];
  loading: boolean;
  showBadges: boolean;
}

/**
 * NavBar — Responsive navigation orchestrator.
 * Renders NavBarDesktop (≥1024px) or NavBarMobile (<1024px).
 * Manages shared state: which category panel is open, command palette visibility.
 */
export const NavBar: React.FC<INavBarProps> = ({ nodes, loading, showBadges }) => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [activeCategory, setActiveCategory] = React.useState<number | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);

  const navRef = React.useRef<HTMLElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Close panel on click outside
  useClickOutside(
    [navRef, panelRef],
    () => setActiveCategory(null),
    activeCategory !== null
  );

  // Close panel on Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && activeCategory !== null) {
        setActiveCategory(null);
      }
      // Cmd+K / Ctrl+K opens command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setActiveCategory(null);
        setCommandPaletteOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeCategory]);

  // Find the active category node
  const activeCategoryNode = React.useMemo(() => {
    if (activeCategory === null) return null;
    return nodes.find(n => n.Id === activeCategory) || null;
  }, [activeCategory, nodes]);

  const handleCategoryClick = React.useCallback((id: number | null) => {
    setActiveCategory(id);
    setCommandPaletteOpen(false);
  }, []);

  const handleSearchClick = React.useCallback(() => {
    setActiveCategory(null);
    setCommandPaletteOpen(true);
  }, []);

  const handlePanelLinkClick = React.useCallback(() => {
    setActiveCategory(null);
  }, []);

  if (loading) {
    return (
      <nav className={styles.nav} aria-label="Main navigation">
        <div className={styles.loading}>Loading navigation...</div>
      </nav>
    );
  }

  return (
    <nav ref={navRef} className={styles.nav} aria-label="Main navigation">
      {isDesktop ? (
        <NavBarDesktop
          nodes={nodes}
          activeCategory={activeCategory}
          onCategoryClick={handleCategoryClick}
          onSearchClick={handleSearchClick}
          showBadges={showBadges}
        />
      ) : (
        <NavBarMobile nodes={nodes} showBadges={showBadges} />
      )}

      {/* Mega Panel (desktop only) */}
      {isDesktop && activeCategoryNode && (
        <div ref={panelRef} className={styles.panelContainer} id={`mega-panel-${activeCategoryNode.Id}`}>
          <MegaPanel
            category={activeCategoryNode}
            showBadges={showBadges}
            onLinkClick={handlePanelLinkClick}
          />
        </div>
      )}

      {/* Command Palette (Cmd+K search) */}
      {commandPaletteOpen && (
        <CommandPalette
          nodes={nodes}
          showBadges={showBadges}
          onClose={() => setCommandPaletteOpen(false)}
        />
      )}
    </nav>
  );
};
