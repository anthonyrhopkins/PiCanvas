import * as React from 'react';
import styles from './PiRadarCommand.module.scss';

interface ICommandFooterProps {
  appPageUrl: string;
}

export const CommandFooter: React.FC<ICommandFooterProps> = ({ appPageUrl }) => (
  <footer className={styles.footer}>
    <div className={styles.footerTop}>
      <div className={styles.footerLogo}>
        <svg viewBox="0 0 24 24" fill="none" width="24" height="24">
          <circle cx="12" cy="12" r="10" stroke="#00d4ff" strokeWidth="1.5" fill="none" />
          <circle cx="12" cy="12" r="2.5" fill="#00d4ff" />
          <line x1="12" y1="2" x2="12" y2="7" stroke="#00d4ff" strokeWidth="1.5" />
          <line x1="12" y1="17" x2="12" y2="22" stroke="#00d4ff" strokeWidth="1.5" opacity="0.4" />
          <line x1="2" y1="12" x2="7" y2="12" stroke="#00d4ff" strokeWidth="1.5" opacity="0.4" />
          <line x1="17" y1="12" x2="22" y2="12" stroke="#00d4ff" strokeWidth="1.5" />
        </svg>
        PiRadar
      </div>

      <div className={styles.footerCol}>
        <div className={styles.footerColTitle}>Platform</div>
        {appPageUrl && <a href={appPageUrl}>Company Profiles</a>}
        <a href="#">Knowledge Graph</a>
        <a href="#">Intel Pipeline</a>
        <a href="#">T&amp;E Reports</a>
        <a href="#">API Documentation</a>
      </div>

      <div className={styles.footerCol}>
        <div className={styles.footerColTitle}>Resources</div>
        <a href="#">Getting Started</a>
        <a href="#">CLI Reference</a>
        <a href="#">Plugin Guide</a>
        <a href="#">Architecture</a>
      </div>

      <div className={styles.footerCol}>
        <div className={styles.footerColTitle}>About</div>
        <a href="#">Team</a>
        <a href="#">Methodology</a>
        <a href="#">Changelog</a>
      </div>
    </div>

    <div className={styles.footerBottom}>
      <div className={styles.footerLegal}>
        &copy; 2026 PiRadar
        <a href="#">Privacy</a>
        <a href="#">Terms</a>
      </div>
      <div className={styles.footerContact}>
        <div className={styles.footerContactLabel}>Contact</div>
        <a href="#">piradar@sap.com</a>
      </div>
    </div>
  </footer>
);
