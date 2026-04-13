import * as React from 'react';
import { INavNode } from '../../hooks/useNavigation';
import { useNavSearch } from '../../hooks/useNavSearch';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { NavLink } from './NavLink';
import styles from './NavBarMobile.module.scss';

interface INavBarMobileProps {
  nodes: INavNode[];
  showBadges: boolean;
}

/**
 * NavBarMobile — Hamburger button + full-screen drawer with
 * search and accordion navigation for mobile/tablet viewports.
 */
export const NavBarMobile: React.FC<INavBarMobileProps> = ({ nodes, showBadges }) => {
  const [open, setOpen] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const drawerRef = React.useRef<HTMLDivElement>(null);
  const hamburgerRef = React.useRef<HTMLButtonElement>(null);

  const { query, setQuery, results, totalCount } = useNavSearch(nodes);
  useFocusTrap(drawerRef, open);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  // Restore focus to hamburger on close
  React.useEffect(() => {
    if (!open && hamburgerRef.current) {
      hamburgerRef.current.focus();
    }
  }, [open]);

  // Lock body scroll when drawer is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
    return undefined;
  }, [open]);

  const handleLinkClick = React.useCallback(() => {
    setOpen(false);
    setQuery('');
  }, [setQuery]);

  const toggleAccordion = React.useCallback((id: number) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const isSearching = query.trim().length > 0;

  return (
    <>
      <div className={styles.bar}>
        <button
          ref={hamburgerRef}
          className={styles.hamburger}
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
          aria-expanded={open}
        >
          &#9776;
        </button>
      </div>

      {open && (
        <>
          {/* Backdrop */}
          <div className={styles.backdrop} onClick={() => setOpen(false)} />

          {/* Drawer */}
          <div
            ref={drawerRef}
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            {/* Header */}
            <div className={styles.drawerHeader}>
              <h2 className={styles.drawerTitle}>Navigation</h2>
              <button
                className={styles.closeBtn}
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
              >
                &#10005;
              </button>
            </div>

            {/* Search */}
            <div className={styles.searchBox}>
              <input
                className={styles.searchInput}
                type="text"
                placeholder={`Search ${totalCount} items...`}
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label="Search navigation"
              />
            </div>

            {/* Scrollable content */}
            <div className={styles.drawerContent}>
              {isSearching ? (
                // Search results mode
                <div className={styles.searchResults}>
                  {results.length === 0 ? (
                    <div className={styles.searchEmpty}>
                      No results for &ldquo;{query}&rdquo;
                    </div>
                  ) : (
                    results.map(r => (
                      <NavLink
                        key={r.node.Id}
                        node={r.node}
                        showBadges={showBadges}
                        breadcrumb={r.breadcrumb}
                        className={styles.searchResultItem}
                        onClick={handleLinkClick}
                      />
                    ))
                  )}
                  <div role="status" aria-live="polite" className={styles.searchEmpty} style={{ padding: '4px 16px', fontStyle: 'normal' }}>
                    {results.length} result{results.length !== 1 ? 's' : ''} found
                  </div>
                </div>
              ) : (
                // Accordion mode
                nodes.map(category => (
                  <div key={category.Id} className={styles.accordionItem}>
                    <button
                      className={styles.accordionTrigger}
                      onClick={() => toggleAccordion(category.Id)}
                      aria-expanded={expandedId === category.Id}
                    >
                      {category.Icon && <span>{category.Icon}</span>}
                      {category.Title}
                      {category.IsNew && showBadges && (
                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'var(--aahub-primary)', color: '#fff' }}>NEW</span>
                      )}
                      <span className={`${styles.accordionChevron} ${expandedId === category.Id ? styles.accordionChevronOpen : ''}`}>
                        &#9660;
                      </span>
                    </button>

                    <div className={`${styles.accordionContent} ${expandedId === category.Id ? styles.accordionContentOpen : ''}`}>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {(category.Children || []).map(child => (
                          <React.Fragment key={child.Id}>
                            {child.Children && child.Children.length > 0 ? (
                              // Sub-header with nested links
                              <>
                                <li className={styles.subHeader}>
                                  {child.Url && child.Url !== '#' ? (
                                    <NavLink node={child} showBadges={showBadges} className={styles.link} onClick={handleLinkClick} />
                                  ) : (
                                    <span>{child.Title}</span>
                                  )}
                                </li>
                                {child.Children.map(grandchild => (
                                  <li key={grandchild.Id} className={styles.linkItem}>
                                    <NavLink
                                      node={grandchild}
                                      showBadges={showBadges}
                                      className={`${styles.link} ${styles.depth2}`}
                                      onClick={handleLinkClick}
                                    />
                                  </li>
                                ))}
                              </>
                            ) : (
                              // Direct link
                              <li className={styles.linkItem}>
                                <NavLink
                                  node={child}
                                  showBadges={showBadges}
                                  className={styles.link}
                                  onClick={handleLinkClick}
                                />
                              </li>
                            )}
                          </React.Fragment>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};
