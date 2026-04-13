import * as React from 'react';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'outline' | 'new';
type BadgeSize = 'sm' | 'md';

interface IBadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  style?: React.CSSProperties;
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  default: {
    background: 'var(--aahub-muted)',
    color: 'var(--aahub-muted-fg)',
  },
  primary: {
    background: 'var(--aahub-primary)',
    color: 'var(--aahub-primary-fg)',
  },
  success: {
    background: 'hsl(142, 71%, 45%)',
    color: '#fff',
  },
  warning: {
    background: 'hsl(38, 92%, 50%)',
    color: '#000',
  },
  destructive: {
    background: 'var(--aahub-destructive)',
    color: 'var(--aahub-destructive-fg)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--aahub-fg)',
    border: '1px solid var(--aahub-border)',
  },
  new: {
    background: 'linear-gradient(135deg, hsl(207, 90%, 54%), hsl(207, 90%, 64%))',
    color: '#fff',
    boxShadow: '0 2px 8px rgba(0, 112, 242, 0.3)',
  },
};

const sizeStyles: Record<BadgeSize, React.CSSProperties> = {
  sm: { padding: '2px 8px', fontSize: '10px' },
  md: { padding: '4px 10px', fontSize: '11px' },
};

export const Badge: React.FC<IBadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className,
  style,
}) => {
  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: 600,
    borderRadius: '6px',
    letterSpacing: '0.3px',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    transition: 'all 200ms ease',
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...style,
  };

  return (
    <span className={className} style={baseStyle}>
      {children}
    </span>
  );
};
