import * as React from 'react';
import { INavNode } from '../../hooks/useNavigation';

interface INavLinkProps {
  node: INavNode;
  showBadges: boolean;
  breadcrumb?: string;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const newBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 6px',
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.5px',
  borderRadius: '4px',
  background: 'linear-gradient(135deg, hsl(207, 90%, 54%), hsl(207, 90%, 64%))',
  color: '#fff',
  marginLeft: '6px',
  flexShrink: 0,
  boxShadow: '0 1px 4px rgba(0, 112, 242, 0.3)',
};

const externalIconStyle: React.CSSProperties = {
  fontSize: '0.7em',
  opacity: 0.4,
  marginLeft: '4px',
};

/**
 * Shared navigation link component.
 * Renders an <a> with optional icon, NEW badge, and external indicator.
 */
export const NavLink: React.FC<INavLinkProps> = ({
  node,
  showBadges,
  breadcrumb,
  className,
  style,
  onClick,
}) => {
  const isExternal = node.OpenInNewWindow || node.IsExternal;

  const handleClick = React.useCallback(() => {
    if (onClick) {
      onClick();
    }
  }, [onClick]);

  return (
    <a
      href={node.Url || '#'}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className={className}
      style={style}
      onClick={handleClick}
    >
      {node.Icon && <span style={{ marginRight: '6px' }}>{node.Icon}</span>}
      <span>{node.Title}</span>
      {node.IsNew && showBadges && <span style={newBadgeStyle}>NEW</span>}
      {isExternal && <span style={externalIconStyle} aria-hidden="true">&#8599;</span>}
      {isExternal && <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>(opens in new window)</span>}
      {breadcrumb && (
        <span style={{ display: 'block', fontSize: '11px', opacity: 0.5, marginTop: '2px' }}>{breadcrumb}</span>
      )}
    </a>
  );
};
