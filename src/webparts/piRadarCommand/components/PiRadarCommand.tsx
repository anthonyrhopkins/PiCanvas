import * as React from 'react';
import styles from './PiRadarCommand.module.scss';
import { IPiRadarCommandProps } from './IPiRadarCommandProps';
import { RadarCanvas } from './RadarCanvas';
import { CapabilityGrid } from './CapabilityGrid';
import { CoverageSection } from './CoverageSection';
import { SignalsFeed } from './SignalsFeed';
import { ReportCards } from './ReportCards';
import { ReportsBrowser } from './ReportsBrowser';
import { CommandFooter } from './CommandFooter';

const RadarLogoSvg: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg viewBox="0 0 28 28" fill="none" width={size} height={size}>
    <circle cx="14" cy="14" r="12" stroke="#00d4ff" strokeWidth="1.5" fill="none" />
    <circle cx="14" cy="14" r="3" fill="#00d4ff" />
    <line x1="14" y1="2" x2="14" y2="8" stroke="#00d4ff" strokeWidth="1.5" />
    <line x1="14" y1="20" x2="14" y2="26" stroke="#00d4ff" strokeWidth="1.5" opacity="0.4" />
    <line x1="2" y1="14" x2="8" y2="14" stroke="#00d4ff" strokeWidth="1.5" opacity="0.4" />
    <line x1="20" y1="14" x2="26" y2="14" stroke="#00d4ff" strokeWidth="1.5" />
  </svg>
);

const ExternalIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" /></svg>
);

const ArrowRight: React.FC = () => (
  <svg viewBox="0 0 16 16" fill="none" width="16" height="16"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" /></svg>
);

export const PiRadarCommand: React.FC<IPiRadarCommandProps> = (props) => {
  const { heroHeadline, appPageUrl, companyCount, recentSignals, reportFiles, spHttpClient, siteUrl } = props;
  const headlineParts = (heroHeadline || 'Programmatic Business Intelligence').split(' ');

  // Split headline into 3 lines: first word, second word, rest
  const lines = headlineParts.length >= 3
    ? [headlineParts[0], headlineParts[1], headlineParts.slice(2).join(' ')]
    : headlineParts;

  const countDisplay = companyCount > 0
    ? `${(companyCount / 1000).toFixed(1).replace(/\.0$/, '')}K`
    : '21.8K';

  return (
    <div className={styles.piRadarCommand}>
      {/* Navigation */}
      <nav className={styles.nav}>
        <a href="#" className={styles.navLogo}>
          <RadarLogoSvg />
          PiRadar
        </a>
        <div className={styles.navCenter}>
          <a href="#" className={styles.active}>Radar</a>
          <a href="#capabilities">Signals</a>
          <a href="#coverage">Coverage</a>
          <a href="#signals">Intel</a>
          <a href="#all-reports">Reports</a>
        </div>
        <div className={styles.navRight}>
          <a href="#">Search</a>
          {appPageUrl && (
            <a href={appPageUrl} className={styles.navCta}>
              App <ExternalIcon />
            </a>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBg}>
          <RadarCanvas />
        </div>
        <div className={styles.heroContent}>
          <h1 className={`${styles.heroHeadline} ${styles.fadeUp}`}>
            {lines.map((line, i) => <span key={i}>{line}</span>)}
          </h1>
          <div className={`${styles.heroMeta} ${styles.fadeUp} ${styles.fadeUpD2}`}>
            <div>Growth Signals<br />From {countDisplay} Companies</div>
            <div className={styles.heroMetaDivider} />
            <div>Est. 2024</div>
            <a href="#capabilities" className={styles.heroExplore}>
              <ArrowRight />
              Explore
            </a>
          </div>
        </div>
      </section>

      {/* Sections */}
      <CapabilityGrid />
      <CoverageSection companyCount={companyCount} appPageUrl={appPageUrl} />
      <SignalsFeed signals={recentSignals} />
      <ReportCards />
      <ReportsBrowser
        reports={reportFiles}
        spHttpClient={spHttpClient}
        siteUrl={siteUrl}
      />
      <CommandFooter appPageUrl={appPageUrl} />
    </div>
  );
};
