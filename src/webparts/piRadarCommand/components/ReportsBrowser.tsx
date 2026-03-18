import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DOMPurify = require('dompurify');
import styles from './PiRadarCommand.module.scss';
import { IReportFile } from './IPiRadarCommandProps';

interface IReportsBrowserProps {
  reports: IReportFile[];
  spHttpClient: SPHttpClient;
  siteUrl: string;
}

type FilterType = 'all' | 'md' | 'html';

const PAGE_SIZE = 12;

const ExternalIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" /></svg>
);

const CloseIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" /></svg>
);

const DocIcon: React.FC<{ type: 'md' | 'html' }> = ({ type }) => (
  <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
    <rect x="1" y="1" width="18" height="22" rx="2" stroke={type === 'md' ? '#00d4ff' : '#6c5ce7'} strokeWidth="1.5" fill="none" />
    <rect x="4" y="5" width="8" height="2" rx="1" fill={type === 'md' ? 'rgba(0,212,255,0.4)' : 'rgba(108,92,231,0.4)'} />
    <rect x="4" y="9" width="12" height="1" rx="0.5" fill="rgba(255,255,255,0.12)" />
    <rect x="4" y="12" width="10" height="1" rx="0.5" fill="rgba(255,255,255,0.08)" />
    <rect x="4" y="15" width="11" height="1" rx="0.5" fill="rgba(255,255,255,0.08)" />
    <rect x="4" y="18" width="6" height="1" rx="0.5" fill="rgba(255,255,255,0.06)" />
  </svg>
);

export const ReportsBrowser: React.FC<IReportsBrowserProps> = ({ reports, spHttpClient, siteUrl }) => {
  const [filter, setFilter] = React.useState<FilterType>('all');
  const [search, setSearch] = React.useState('');
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [selectedReport, setSelectedReport] = React.useState<IReportFile | null>(null);
  const [reportContent, setReportContent] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);

  const filtered = React.useMemo(() => {
    let list = reports;
    if (filter !== 'all') {
      list = list.filter(r => r.fileType === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.companyName.toLowerCase().includes(q) ||
        r.domain.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [reports, filter, search]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const mdCount = reports.filter(r => r.fileType === 'md').length;
  const htmlCount = reports.filter(r => r.fileType === 'html').length;

  const openReport = React.useCallback(async (report: IReportFile) => {
    setSelectedReport(report);
    setReportContent('');
    setLoading(true);
    try {
      const apiUrl = `${siteUrl}/_api/web/GetFileByServerRelativeUrl('${encodeURIComponent(report.serverRelativeUrl)}')/$value`;
      const response = await spHttpClient.get(apiUrl, SPHttpClient.configurations.v1);
      if (response.ok) {
        const text = await response.text();
        setReportContent(text);
      } else {
        setReportContent(`Failed to load report (HTTP ${response.status})`);
      }
    } catch (e) {
      setReportContent(`Error loading report: ${e}`);
    }
    setLoading(false);
  }, [spHttpClient, siteUrl]);

  const closeReport = React.useCallback(() => {
    setSelectedReport(null);
    setReportContent('');
  }, []);

  // Convert markdown to simple HTML for display
  const renderContent = React.useMemo((): string => {
    if (!reportContent) return '';
    if (selectedReport?.fileType === 'html') {
      return DOMPurify.sanitize(reportContent, {
        USE_PROFILES: { html: true },
        ADD_TAGS: ['style'],
        ADD_ATTR: ['target', 'rel', 'style', 'class'],
        ALLOW_DATA_ATTR: true,
        FORBID_TAGS: ['script'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onfocus', 'onblur']
      }) as string;
    }

    // Basic markdown → HTML conversion
    return reportContent
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/^---$/gm, '<hr />')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hul1-9hlp])(.+)$/gm, '<p>$1</p>');
  }, [reportContent, selectedReport]);

  return (
    <section className={styles.reportsBrowser} id="all-reports">
      <div className={styles.reportsBrowserHeader}>
        <div>
          <h2 className={styles.reportsBrowserTitle}>Intelligence Reports</h2>
          <div className={styles.reportsBrowserMeta}>
            {reports.length} reports across {new Set(reports.map(r => r.domain)).size} companies
          </div>
        </div>
      </div>

      {/* Toolbar: filters + search */}
      <div className={styles.reportsBrowserToolbar}>
        <div className={styles.reportsBrowserFilters}>
          <button
            className={`${styles.filterBtn} ${filter === 'all' ? styles.filterBtnActive : ''}`}
            onClick={() => { setFilter('all'); setVisibleCount(PAGE_SIZE); }}
          >
            All ({reports.length})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'md' ? styles.filterBtnActive : ''}`}
            onClick={() => { setFilter('md'); setVisibleCount(PAGE_SIZE); }}
          >
            Method-K ({mdCount})
          </button>
          <button
            className={`${styles.filterBtn} ${filter === 'html' ? styles.filterBtnActive : ''}`}
            onClick={() => { setFilter('html'); setVisibleCount(PAGE_SIZE); }}
          >
            Final HTML ({htmlCount})
          </button>
        </div>
        <div className={styles.reportsBrowserSearch}>
          <input
            type="text"
            placeholder="Search by company or domain..."
            value={search}
            onChange={e => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Report Grid */}
      <div className={styles.reportsGridBrowse}>
        {visible.map(report => (
          <button
            key={report.serverRelativeUrl}
            className={styles.reportItem}
            onClick={() => openReport(report)}
          >
            <div className={styles.reportItemIcon}>
              <DocIcon type={report.fileType} />
            </div>
            <div className={styles.reportItemInfo}>
              <div className={styles.reportItemName}>{report.companyName}</div>
              <div className={styles.reportItemDomain}>{report.domain}</div>
            </div>
            <div className={styles.reportItemMeta}>
              <span className={`${styles.reportItemBadge} ${report.fileType === 'md' ? styles.badgeMd : styles.badgeHtml}`}>
                {report.fileType === 'md' ? 'Method-K' : 'Final'}
              </span>
              {report.created && (
                <span className={styles.reportItemDate}>
                  {new Date(report.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
            </div>
            <div className={styles.reportItemArrow}><ExternalIcon /></div>
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className={styles.reportsEmpty}>
          {reports.length === 0
            ? 'No reports found in the Profiles library.'
            : `No reports match "${search}".`
          }
        </div>
      )}

      {hasMore && (
        <div className={styles.reportsLoadMore}>
          <button
            className={styles.loadMoreBtn}
            onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
          >
            Load More ({filtered.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {/* Report Viewer Overlay */}
      {selectedReport && (
        <div className={styles.reportOverlay} onClick={closeReport}>
          <div className={styles.reportViewer} onClick={e => e.stopPropagation()}>
            <div className={styles.reportViewerHeader}>
              <div>
                <div className={styles.reportViewerTitle}>{selectedReport.companyName}</div>
                <div className={styles.reportViewerSub}>
                  {selectedReport.domain}
                  <span className={`${styles.reportItemBadge} ${selectedReport.fileType === 'md' ? styles.badgeMd : styles.badgeHtml}`}>
                    {selectedReport.fileType === 'md' ? 'Method-K' : 'Final Report'}
                  </span>
                </div>
              </div>
              <button className={styles.reportViewerClose} onClick={closeReport}>
                <CloseIcon />
              </button>
            </div>
            <div className={styles.reportViewerBody}>
              {loading ? (
                <div className={styles.reportViewerLoading}>Loading report...</div>
              ) : (
                <div
                  className={styles.reportViewerContent}
                  dangerouslySetInnerHTML={{ __html: renderContent }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
