import * as React from 'react';
import styles from './PiRadarCommand.module.scss';

const ExternalIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" /></svg>
);

interface ICoverageSectionProps {
  companyCount: number;
  appPageUrl: string;
}

const tiers = [
  { label: 'Tier 5 Regulatory', width: '85%', style: styles.tier5Bar, description: 'SEC, FDA, USPTO, IRS' },
  { label: 'Tier 4 Direct', width: '72%', style: styles.tier4Bar, description: 'Newsrooms, Press Releases' },
  { label: 'Tier 3 Media', width: '68%', style: styles.tier3Bar, description: 'Yahoo Finance, Seeking Alpha' },
  { label: 'Tier 2 Wire', width: '55%', style: styles.tier2Bar, description: 'Job Boards, Wire Services' },
  { label: 'Tier 1 Specialized', width: '40%', style: styles.tier1Bar, description: 'Intl. Registries (FR, DE, NL, BE)' },
];

export const CoverageSection: React.FC<ICoverageSectionProps> = ({ companyCount, appPageUrl }) => {
  const formattedCount = companyCount > 0
    ? `${(companyCount / 1000).toFixed(1).replace(/\.0$/, '')}K+`
    : '21,800+';

  const stats = [
    { value: formattedCount, label: 'Companies Tracked' },
    { value: '147', label: 'Data Sources' },
    { value: '680K+', label: 'Growth Events' },
    { value: '25', label: 'Relationship Types' },
    { value: '99', label: 'Account Owners' },
  ];

  return (
    <section className={styles.coverage} id="coverage">
      <div className={styles.coverageHeader}>
        <h2 className={styles.coverageTitle}>Coverage</h2>
        {appPageUrl && (
          <a href={appPageUrl} className={styles.coverageLink}>
            Full Dashboard <ExternalIcon />
          </a>
        )}
      </div>

      <div className={styles.coverageVisual}>
        <div className={styles.tierBars}>
          {tiers.map(tier => (
            <div className={styles.tierRow} key={tier.label}>
              <div className={styles.tierLabel}>{tier.label}</div>
              <div
                className={`${styles.tierBar} ${tier.style}`}
                style={{ width: tier.width }}
              >
                <span className={styles.tierBarLabel}>{tier.description}</span>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.coverageStats}>
          {stats.map(stat => (
            <div className={styles.coverageStat} key={stat.label}>
              <div className={styles.coverageStatValue}>{stat.value}</div>
              <div className={styles.coverageStatLabel}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
