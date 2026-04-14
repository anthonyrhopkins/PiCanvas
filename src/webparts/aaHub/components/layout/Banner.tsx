import * as React from 'react';

interface IBannerProps {
  title: string;
  iconUrl?: string;
  children?: React.ReactNode;
}

const bannerStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  display: 'grid',
  gridTemplateColumns: '110px minmax(0, 1fr) 110px',
  background: 'var(--hub-card-bg, #1d232a)',
  borderBottom: '1px solid var(--hub-card-border, rgba(0,112,242,0.15))',
};

const logoContainerStyle: React.CSSProperties = {
  gridRow: '1 / 3',
  gridColumn: '1',
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'stretch',
  borderRight: '1px solid rgba(255,255,255,0.06)',
  overflow: 'hidden',
};

const logoImgStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  filter: 'drop-shadow(0 2px 8px rgba(0,112,242,0.2))',
};

const headerStyle: React.CSSProperties = {
  gridColumn: '2',
  gridRow: '1',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  padding: '10px 16px',
};

const titleStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 700,
  color: 'var(--hub-heading, #fff)',
  letterSpacing: '0.3px',
  margin: 0,
};

export const Banner: React.FC<IBannerProps> = ({ title, iconUrl, children }) => {
  return (
    <div style={bannerStyle}>
      {iconUrl && (
        <div style={logoContainerStyle}>
          <img src={iconUrl} alt={`${title} logo`} style={logoImgStyle} />
        </div>
      )}
      <header style={headerStyle}>
        <h1 style={titleStyle}>{title}</h1>
      </header>
      {/* Navigation slot — MegaMenu rendered here */}
      <div style={{ gridColumn: '2', gridRow: '2' }}>
        {children}
      </div>
    </div>
  );
};
