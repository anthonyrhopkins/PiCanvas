import * as React from 'react';
import styles from './GlassCard.module.scss';

type CardVariant = 'default' | 'elevated' | 'ghost';
type CardPadding = 'default' | 'compact' | 'none';

interface IGlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
  padding?: CardPadding;
  onClick?: () => void;
  style?: React.CSSProperties;
}

const variantMap: Record<CardVariant, string> = {
  default: '',
  elevated: styles.elevated,
  ghost: styles.ghost,
};

const paddingMap: Record<CardPadding, string> = {
  default: '',
  compact: styles.compact,
  none: styles.noPad,
};

export const GlassCard: React.FC<IGlassCardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'default',
  onClick,
  style,
}) => {
  const classes = [
    styles.glassCard,
    variantMap[variant],
    paddingMap[padding],
    onClick ? '' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={style}
    >
      <div className={styles.content}>{children}</div>
    </div>
  );
};

// Compound components
export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`${styles.header} ${className}`}>{children}</div>
);

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <h3 className={`${styles.title} ${className}`}>{children}</h3>
);

export const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`${styles.description} ${className}`}>{children}</p>
);

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`${styles.footer} ${className}`}>{children}</div>
);
