import * as React from 'react';
import { INavNode } from '../../hooks/useNavigation';
import { NavLink } from './NavLink';
import styles from './MegaPanel.module.scss';

interface IMegaPanelProps {
  category: INavNode;
  showBadges: boolean;
  onLinkClick: () => void;
}

/**
 * MegaPanel — Multi-column dropdown panel for a single category.
 * Arranges children in columns: each child-with-children becomes a column
 * with a header + link list. Children-without-children grouped as "Direct Links".
 */
export const MegaPanel: React.FC<IMegaPanelProps> = ({ category, showBadges, onLinkClick }) => {
  const children = category.Children || [];

  if (children.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>No items in this category.</div>
      </div>
    );
  }

  // Split children: those with sub-children get their own column,
  // those without are grouped into a "Direct Links" column
  const columns: INavNode[] = [];
  const directLinks: INavNode[] = [];

  for (const child of children) {
    if (child.Children && child.Children.length > 0) {
      columns.push(child);
    } else {
      directLinks.push(child);
    }
  }

  return (
    <div className={styles.panel} role="region" aria-label={`${category.Title} navigation`}>
      <div className={styles.grid}>
        {/* Columns for items with children */}
        {columns.map(col => (
          <div key={col.Id} className={styles.column}>
            <div className={styles.columnHeader}>
              {col.Url && col.Url !== '#' ? (
                <a href={col.Url} target="_blank" rel="noopener noreferrer" className={styles.columnTitleLink}>
                  <h3 className={styles.columnTitle}>{col.Title}</h3>
                </a>
              ) : (
                <h3 className={styles.columnTitle}>{col.Title}</h3>
              )}
              {col.IsNew && showBadges && (
                <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'var(--aahub-primary)', color: '#fff' }}>NEW</span>
              )}
            </div>
            <ul className={styles.linkList}>
              {col.Children.map(link => (
                <li key={link.Id}>
                  <NavLink
                    node={link}
                    showBadges={showBadges}
                    className={styles.link}
                    onClick={onLinkClick}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Direct links column */}
        {directLinks.length > 0 && (
          <div className={`${styles.column} ${styles.directLinks}`}>
            <div className={styles.columnHeader}>
              <h3 className={styles.columnTitle}>Quick Links</h3>
            </div>
            <ul className={styles.linkList}>
              {directLinks.map(link => (
                <li key={link.Id}>
                  <NavLink
                    node={link}
                    showBadges={showBadges}
                    className={styles.link}
                    onClick={onLinkClick}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
