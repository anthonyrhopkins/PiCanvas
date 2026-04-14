import * as React from 'react';
import { GlassCard } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { IQuickAccessCategory, IQuickAccessItem } from '../../services/QuickAccessService';

interface IQuickAccessGridProps {
  categories: IQuickAccessCategory[];
  showBadges: boolean;
  loading: boolean;
}

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: '18px',
  fontWeight: 700,
  color: '#fff',
  letterSpacing: '0.3px',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: '16px',
};

const categoryTitleStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '13px',
  fontWeight: 700,
  color: '#4DB1FF',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const linkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 0',
  color: '#B8C4D0',
  textDecoration: 'none',
  fontSize: '12px',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  transition: 'color 200ms ease, padding-left 200ms ease',
};

const CategoryCard: React.FC<{
  category: IQuickAccessCategory;
  showBadges: boolean;
}> = ({ category, showBadges }) => (
  <GlassCard padding="compact">
    <h3 style={categoryTitleStyle}>{category.name}</h3>
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {category.items.map((item: IQuickAccessItem) => (
        <li key={item.id}>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            {item.title}
            {item.isNew && showBadges && (
              <Badge variant="new" size="sm">{item.badgeLabel}</Badge>
            )}
          </a>
        </li>
      ))}
    </ul>
  </GlassCard>
);

const SkeletonGrid: React.FC = () => (
  <div style={gridStyle}>
    {[1, 2, 3, 4, 5].map(i => (
      <GlassCard key={i} padding="compact">
        <div style={{
          height: '14px', width: '120px', marginBottom: '12px',
          borderRadius: '4px', background: 'var(--aahub-muted)', opacity: 0.3,
        }} />
        {[1, 2, 3].map(j => (
          <div key={j} style={{
            height: '16px', marginBottom: '8px',
            borderRadius: '4px', background: 'var(--aahub-muted)', opacity: 0.2,
            animation: 'pulseSlow 2s ease-in-out infinite',
          }} />
        ))}
      </GlassCard>
    ))}
  </div>
);

export const QuickAccessGrid: React.FC<IQuickAccessGridProps> = ({ categories, showBadges, loading }) => {
  return (
    <div>
      <h2 style={sectionTitleStyle}>Quick Access Tools</h2>
      {loading ? (
        <SkeletonGrid />
      ) : (
        <div style={gridStyle}>
          {categories.map(cat => (
            <CategoryCard key={cat.name} category={cat} showBadges={showBadges} />
          ))}
        </div>
      )}
    </div>
  );
};
