import * as React from 'react';
import { NewsCards } from '../sections/NewsCards';
import { QuickAccessGrid } from '../sections/QuickAccessGrid';
import { useNews } from '../../hooks/useNews';
import { useQuickAccess } from '../../hooks/useQuickAccess';

interface IHeroSectionProps {
  showBadges: boolean;
}

const heroContentStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  maxWidth: '1400px',
  margin: '0 auto',
  padding: '24px 20px 40px',
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
};

/**
 * HeroSection — Main content area below the navigation banner.
 * Composes NewsCards and QuickAccessGrid, both wired to SharePoint list data.
 */
export const HeroSection: React.FC<IHeroSectionProps> = ({ showBadges }) => {
  const { topNews, goodToKnow, loading: newsLoading } = useNews();
  const { categories, loading: qaLoading } = useQuickAccess();

  return (
    <div style={heroContentStyle}>
      {/* News cards: Top News + Good to Know */}
      <NewsCards
        topNews={topNews}
        goodToKnow={goodToKnow}
        showBadges={showBadges}
        loading={newsLoading}
      />

      {/* Quick Access Tools grid */}
      <QuickAccessGrid
        categories={categories}
        showBadges={showBadges}
        loading={qaLoading}
      />
    </div>
  );
};
