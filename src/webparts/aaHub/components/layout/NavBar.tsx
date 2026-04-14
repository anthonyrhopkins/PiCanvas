import * as React from 'react';
import { INavNode } from '../../hooks/useNavigation';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { NavBarDesktop } from './NavBarDesktop';
import { NavBarMobile } from './NavBarMobile';
import { CommandPalette } from './CommandPalette';
import styles from './NavBar.module.scss';

interface INavBarProps {
  nodes: INavNode[];
  loading: boolean;
  showBadges: boolean;
}

/**
 * NavBar — Responsive navigation orchestrator.
 * Renders NavBarDesktop (≥1024px) or NavBarMobile (<1024px).
 * NavBarDesktop handles its own dropdown state internally.
 */
export const NavBar: React.FC<INavBarProps> = ({ nodes, loading, showBadges }) => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [activeCategory, setActiveCategory] = React.useState<number | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);

  // Cmd+K / Ctrl+K + Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (commandPaletteOpen) setCommandPaletteOpen(false);
        else if (activeCategory !== null) setActiveCategory(null);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setActiveCategory(null);
        setCommandPaletteOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeCategory, commandPaletteOpen]);

  const handleCategoryClick = React.useCallback((id: number | null) => {
    setActiveCategory(id);
    setCommandPaletteOpen(false);
  }, []);

  const handleSearchClick = React.useCallback(() => {
    setActiveCategory(null);
    setCommandPaletteOpen(true);
  }, []);

  if (loading) {
    return (
      <nav className={styles.nav} aria-label="Main navigation">
        <div className={styles.loading}>Loading navigation...</div>
      </nav>
    );
  }

  return (
    <nav className={styles.nav} aria-label="Main navigation">
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
