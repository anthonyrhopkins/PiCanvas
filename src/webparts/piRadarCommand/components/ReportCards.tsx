import * as React from 'react';
import styles from './PiRadarCommand.module.scss';

const ExternalIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" /></svg>
);

export const ReportCards: React.FC = () => (
  <section className={styles.reports} id="reports">
    <div className={styles.reportsGrid}>
      {/* Methodology Card */}
      <div className={`${styles.reportCard} ${styles.reportCardOlive}`}>
        <div className={styles.reportCardTop}>
          <h3 className={styles.reportCardTitle}>Growth Radar Methodology</h3>
          <a href="#" className={styles.reportCardLink}>Read More <ExternalIcon /></a>
        </div>
        <div className={styles.reportCardDivider} />
        <div className={styles.reportCardBottom}>
          <div className={styles.reportCardVisual} style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.05) 0%, rgba(0,80,100,0.15) 100%)' }}>
            <svg width="100%" height="100%" viewBox="0 0 400 180" preserveAspectRatio="xMidYMid meet">
              <polygon points="200,20 320,160 80,160" fill="none" stroke="rgba(0,212,255,0.2)" strokeWidth="1" />
              <line x1="115" y1="100" x2="285" y2="100" stroke="rgba(0,212,255,0.15)" strokeWidth="1" />
              <line x1="140" y1="130" x2="260" y2="130" stroke="rgba(0,212,255,0.1)" strokeWidth="1" />
              <line x1="155" y1="70" x2="245" y2="70" stroke="rgba(0,212,255,0.12)" strokeWidth="1" />
              <text x="200" y="55" textAnchor="middle" fill="rgba(0,212,255,0.4)" fontSize="10" fontFamily="monospace">T5</text>
              <text x="200" y="88" textAnchor="middle" fill="rgba(0,212,255,0.35)" fontSize="10" fontFamily="monospace">T4</text>
              <text x="200" y="118" textAnchor="middle" fill="rgba(0,212,255,0.3)" fontSize="10" fontFamily="monospace">T3</text>
              <text x="200" y="148" textAnchor="middle" fill="rgba(0,212,255,0.25)" fontSize="10" fontFamily="monospace">T2 / T1</text>
            </svg>
          </div>
          <div className={styles.reportCardLabel}>Verification Framework</div>
        </div>
      </div>

      {/* Sector Analysis Card */}
      <div className={`${styles.reportCard} ${styles.reportCardSlate}`}>
        <div className={styles.reportCardTop}>
          <h3 className={styles.reportCardTitle}>Sector Analysis Framework</h3>
          <a href="#" className={styles.reportCardLink}>Read More <ExternalIcon /></a>
        </div>
        <div className={styles.reportCardDivider} />
        <div className={styles.reportCardBottom}>
          <div className={styles.reportCardVisual} style={{ background: 'linear-gradient(135deg, rgba(108,92,231,0.05) 0%, rgba(60,40,120,0.15) 100%)' }}>
            <svg width="100%" height="100%" viewBox="0 0 400 180" preserveAspectRatio="xMidYMid meet">
              <rect x="40" y="30" width="28" height="120" rx="2" fill="rgba(108,92,231,0.3)" />
              <rect x="80" y="50" width="28" height="100" rx="2" fill="rgba(108,92,231,0.25)" />
              <rect x="120" y="40" width="28" height="110" rx="2" fill="rgba(108,92,231,0.28)" />
              <rect x="160" y="70" width="28" height="80" rx="2" fill="rgba(108,92,231,0.2)" />
              <rect x="200" y="45" width="28" height="105" rx="2" fill="rgba(108,92,231,0.27)" />
              <rect x="240" y="55" width="28" height="95" rx="2" fill="rgba(108,92,231,0.22)" />
              <rect x="280" y="80" width="28" height="70" rx="2" fill="rgba(108,92,231,0.18)" />
              <rect x="320" y="60" width="28" height="90" rx="2" fill="rgba(108,92,231,0.24)" />
              <line x1="30" y1="150" x2="370" y2="150" stroke="rgba(108,92,231,0.15)" strokeWidth="1" />
            </svg>
          </div>
          <div className={styles.reportCardLabel}>14 Sectors Covered</div>
        </div>
      </div>
    </div>
  </section>
);
