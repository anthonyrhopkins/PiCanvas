import * as React from 'react';
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface IButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const baseStyles: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  borderRadius: '8px',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'all 200ms ease',
  border: 'none',
  position: 'relative',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  lineHeight: 1.4,
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'var(--aahub-primary)',
    color: 'var(--aahub-primary-fg)',
    boxShadow: '0 2px 8px rgba(0, 112, 242, 0.3)',
  },
  secondary: {
    background: 'var(--aahub-glass-bg)',
    color: 'var(--aahub-fg)',
    border: '1px solid var(--aahub-glass-border)',
    backdropFilter: 'blur(8px)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--aahub-fg)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--aahub-fg)',
    border: '1px solid var(--aahub-border)',
  },
  danger: {
    background: 'var(--aahub-destructive)',
    color: 'var(--aahub-destructive-fg)',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { height: '32px', padding: '0 12px', fontSize: '12px' },
  md: { height: '36px', padding: '0 16px', fontSize: '13px' },
  lg: { height: '40px', padding: '0 24px', fontSize: '14px' },
  icon: { height: '36px', width: '36px', padding: 0 },
};

export const Button: React.FC<IButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  style,
  className,
  ...rest
}) => {
  const mergedStyle: React.CSSProperties = {
    ...baseStyles,
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...(disabled || loading ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
    ...style,
  };

  return (
    <button
      className={className}
      style={mergedStyle}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && (
        <span style={{
          width: '14px',
          height: '14px',
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite',
          flexShrink: 0,
        }} />
      )}
      {children}
    </button>
  );
};
