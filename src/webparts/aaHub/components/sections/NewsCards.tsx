import * as React from 'react';
import { GlassCard, CardHeader, CardTitle } from '../ui/GlassCard';
import { Badge } from '../ui/Badge';
import { INewsItem } from '../../hooks/useNews';

interface INewsCardsProps {
  topNews: INewsItem[];
  goodToKnow: INewsItem[];
  showBadges: boolean;
  loading: boolean;
}

const cardsRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '20px',
};

const linkStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 0',
  color: 'var(--hub-link, #D5DADF)',
  textDecoration: 'none',
  fontSize: 'calc(var(--aahub-fs, 13) * 1px)',
  borderBottom: '1px solid var(--hub-divider, rgba(255,255,255,0.04))',
  transition: 'color 200ms ease, padding-left 200ms ease',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  color: 'var(--hub-accent, #4DB1FF)',
  fontSize: 'calc(var(--aahub-fs, 13) * 1px)',
  marginBottom: '4px',
};

const richContentStyle: React.CSSProperties = {
  fontSize: 'calc((var(--aahub-fs, 13) - 1) * 1px)',
  color: 'var(--hub-text-muted, #8496A7)',
  lineHeight: 1.5,
};

const NewsItem: React.FC<{ item: INewsItem; showBadges: boolean }> = ({ item, showBadges }) => {
  // Rich content item (has NewsContent)
  if (item.content) {
    return (
      <li style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }} title={item.hoverText || undefined}>
        {item.url ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" style={labelStyle}>
            {item.title}
            {item.isNew && showBadges && <Badge variant="new" size="sm" style={{ marginLeft: '6px' }}>NEW</Badge>}
          </a>
        ) : (
          <span style={labelStyle}>
            {item.title}
            {item.isNew && showBadges && <Badge variant="new" size="sm" style={{ marginLeft: '6px' }}>NEW</Badge>}
          </span>
        )}
        <div style={richContentStyle} dangerouslySetInnerHTML={{ __html: item.content }} />
      </li>
    );
  }

  // Simple link item
  if (item.url) {
    return (
      <li title={item.hoverText || undefined}>
        <a href={item.url} target="_blank" rel="noopener noreferrer" style={linkStyle}>
          {item.title}
          {item.isNew && showBadges && <Badge variant="new" size="sm">NEW</Badge>}
        </a>
      </li>
    );
  }

  // Plain text fallback
  return (
    <li style={{ ...linkStyle, cursor: 'default' }}>
      {item.title}
    </li>
  );
};

const SkeletonCard: React.FC = () => (
  <GlassCard>
    <CardHeader><CardTitle>Loading...</CardTitle></CardHeader>
    {[1, 2, 3, 4].map(i => (
      <div key={i} style={{
        height: '20px',
        marginBottom: '12px',
        borderRadius: '6px',
        background: 'var(--aahub-muted)',
        opacity: 0.3,
        animation: 'pulseSlow 2s ease-in-out infinite',
      }} />
    ))}
  </GlassCard>
);

export const NewsCards: React.FC<INewsCardsProps> = ({ topNews, goodToKnow, showBadges, loading }) => {
  if (loading) {
    return (
      <div style={cardsRowStyle}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div style={cardsRowStyle}>
      {topNews.length > 0 && (
        <GlassCard>
          <CardHeader>
            <CardTitle>Top News</CardTitle>
          </CardHeader>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {topNews.map(item => (
              <NewsItem key={item.id} item={item} showBadges={showBadges} />
            ))}
          </ul>
        </GlassCard>
      )}

      {goodToKnow.length > 0 && (
        <GlassCard>
          <CardHeader>
            <CardTitle>Good to Know</CardTitle>
          </CardHeader>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {goodToKnow.map(item => (
              <NewsItem key={item.id} item={item} showBadges={showBadges} />
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
};
