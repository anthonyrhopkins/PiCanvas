import * as React from 'react';
import styles from './PiRadarCommand.module.scss';

const ArrowIcon: React.FC = () => (
  <svg viewBox="0 0 14 14" fill="none"><path d="M3 11L11 3M11 3H5M11 3V9" stroke="white" strokeWidth="1.5" /></svg>
);

export const CapabilityGrid: React.FC = () => (
  <section className={styles.capabilities} id="capabilities">
    <div className={styles.capGrid}>
      <div className={styles.capGridTop}>
        {/* Discovery */}
        <div className={`${styles.capCard} ${styles.vizDiscovery}`}>
          <div className={styles.capCardVisual}>
            <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
              <circle cx="100" cy="100" r="80" stroke="rgba(0,212,255,0.12)" strokeWidth="1" />
              <circle cx="100" cy="100" r="55" stroke="rgba(0,212,255,0.08)" strokeWidth="1" />
              <circle cx="100" cy="100" r="30" stroke="rgba(0,212,255,0.15)" strokeWidth="1" />
              <circle cx="100" cy="100" r="4" fill="#00d4ff" opacity="0.8" />
              <line x1="100" y1="100" x2="170" y2="60" stroke="rgba(0,212,255,0.3)" strokeWidth="1">
                <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="8s" repeatCount="indefinite" />
              </line>
              <circle cx="145" cy="65" r="3" fill="#00d4ff" opacity="0.6">
                <animate attributeName="opacity" values="0.2;0.8;0.2" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="60" cy="130" r="2.5" fill="#00d4ff" opacity="0.4">
                <animate attributeName="opacity" values="0.4;0.9;0.4" dur="3s" repeatCount="indefinite" />
              </circle>
              <circle cx="130" cy="140" r="2" fill="#00d4ff" opacity="0.5">
                <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2.5s" repeatCount="indefinite" />
              </circle>
              <circle cx="70" cy="70" r="2" fill="#00d4ff" opacity="0.3">
                <animate attributeName="opacity" values="0.1;0.6;0.1" dur="4s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>
          <div className={styles.capCardContent}>
            <div>
              <div className={styles.capCardName}>Discovery</div>
              <div className={styles.capCardSub}>5-Tier Verification System</div>
            </div>
            <div className={styles.capCardArrow}><ArrowIcon /></div>
          </div>
        </div>

        {/* Knowledge Graph */}
        <div className={`${styles.capCard} ${styles.vizGraph}`}>
          <div className={styles.capCardVisual}>
            <svg width="240" height="200" viewBox="0 0 240 200" fill="none">
              <line x1="120" y1="60" x2="60" y2="120" stroke="rgba(0,184,148,0.25)" strokeWidth="1" />
              <line x1="120" y1="60" x2="180" y2="100" stroke="rgba(0,184,148,0.25)" strokeWidth="1" />
              <line x1="120" y1="60" x2="100" y2="160" stroke="rgba(0,184,148,0.15)" strokeWidth="1" />
              <line x1="60" y1="120" x2="100" y2="160" stroke="rgba(0,184,148,0.2)" strokeWidth="1" />
              <line x1="180" y1="100" x2="200" y2="150" stroke="rgba(0,184,148,0.15)" strokeWidth="1" />
              <line x1="180" y1="100" x2="140" y2="160" stroke="rgba(0,184,148,0.2)" strokeWidth="1" />
              <line x1="60" y1="120" x2="40" y2="80" stroke="rgba(0,184,148,0.15)" strokeWidth="1" />
              <line x1="120" y1="60" x2="160" y2="40" stroke="rgba(0,184,148,0.15)" strokeWidth="1" />
              <circle cx="120" cy="60" r="8" fill="#00b894" opacity="0.8" />
              <circle cx="60" cy="120" r="6" fill="#00b894" opacity="0.6" />
              <circle cx="180" cy="100" r="6" fill="#00b894" opacity="0.6" />
              <circle cx="100" cy="160" r="5" fill="#00b894" opacity="0.5" />
              <circle cx="200" cy="150" r="4" fill="#00b894" opacity="0.4" />
              <circle cx="140" cy="160" r="4" fill="#00b894" opacity="0.4" />
              <circle cx="40" cy="80" r="4" fill="#00b894" opacity="0.3" />
              <circle cx="160" cy="40" r="4" fill="#00b894" opacity="0.3" />
              <circle cx="120" cy="60" r="8" fill="none" stroke="#00b894" strokeWidth="1" opacity="0.4">
                <animate attributeName="r" values="8;20;8" dur="3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>
          <div className={styles.capCardContent}>
            <div>
              <div className={styles.capCardName}>Knowledge Graph</div>
              <div className={styles.capCardSub}>25 Relationship Types</div>
            </div>
            <div className={styles.capCardArrow}><ArrowIcon /></div>
          </div>
        </div>

        {/* Intel Pipeline */}
        <div className={`${styles.capCard} ${styles.vizIntel}`}>
          <div className={styles.capCardVisual}>
            <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
              <rect x="30" y="40" width="40" height="24" rx="3" fill="rgba(108,92,231,0.3)" stroke="rgba(108,92,231,0.5)" strokeWidth="1" />
              <rect x="80" y="60" width="40" height="24" rx="3" fill="rgba(108,92,231,0.35)" stroke="rgba(108,92,231,0.5)" strokeWidth="1" />
              <rect x="130" y="80" width="40" height="24" rx="3" fill="rgba(108,92,231,0.4)" stroke="rgba(108,92,231,0.5)" strokeWidth="1" />
              <rect x="80" y="110" width="40" height="24" rx="3" fill="rgba(108,92,231,0.45)" stroke="rgba(108,92,231,0.5)" strokeWidth="1" />
              <rect x="30" y="140" width="140" height="28" rx="3" fill="rgba(108,92,231,0.2)" stroke="rgba(108,92,231,0.4)" strokeWidth="1" />
              <path d="M70 52 L80 65" stroke="rgba(108,92,231,0.4)" strokeWidth="1" />
              <path d="M120 72 L130 85" stroke="rgba(108,92,231,0.4)" strokeWidth="1" />
              <path d="M150 104 L120 115" stroke="rgba(108,92,231,0.4)" strokeWidth="1" />
              <path d="M100 134 L100 140" stroke="rgba(108,92,231,0.4)" strokeWidth="1" />
              <text x="50" y="56" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="monospace">SCAN</text>
              <text x="100" y="76" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="monospace">ENRICH</text>
              <text x="150" y="96" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="monospace">VERIFY</text>
              <text x="100" y="126" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="monospace">SCORE</text>
              <text x="100" y="158" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="9" fontFamily="monospace">INTELLIGENCE</text>
              <circle r="3" fill="#6c5ce7">
                <animateMotion path="M50,52 L100,72 L150,92 L100,122 L100,154" dur="4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;1;0.3" dur="4s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>
          <div className={styles.capCardContent}>
            <div>
              <div className={styles.capCardName}>Intelligence Pipeline</div>
              <div className={styles.capCardSub}>Multi-Phase DAG Orchestrator</div>
            </div>
            <div className={styles.capCardArrow}><ArrowIcon /></div>
          </div>
        </div>
      </div>

      <div className={styles.capGridBottom}>
        {/* AI Enrichment */}
        <div className={`${styles.capCard} ${styles.vizEnrichment}`}>
          <div className={styles.capCardVisual}>
            <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
              <circle cx="50" cy="60" r="5" fill="rgba(212,165,71,0.5)" />
              <circle cx="50" cy="100" r="5" fill="rgba(212,165,71,0.5)" />
              <circle cx="50" cy="140" r="5" fill="rgba(212,165,71,0.5)" />
              <circle cx="100" cy="70" r="5" fill="rgba(212,165,71,0.6)" />
              <circle cx="100" cy="110" r="5" fill="rgba(212,165,71,0.6)" />
              <circle cx="100" cy="140" r="5" fill="rgba(212,165,71,0.6)" />
              <circle cx="150" cy="80" r="6" fill="rgba(212,165,71,0.8)" />
              <circle cx="150" cy="120" r="6" fill="rgba(212,165,71,0.8)" />
              <line x1="55" y1="60" x2="95" y2="70" stroke="rgba(212,165,71,0.2)" strokeWidth="1" />
              <line x1="55" y1="60" x2="95" y2="110" stroke="rgba(212,165,71,0.15)" strokeWidth="1" />
              <line x1="55" y1="100" x2="95" y2="70" stroke="rgba(212,165,71,0.15)" strokeWidth="1" />
              <line x1="55" y1="100" x2="95" y2="110" stroke="rgba(212,165,71,0.2)" strokeWidth="1" />
              <line x1="55" y1="140" x2="95" y2="110" stroke="rgba(212,165,71,0.15)" strokeWidth="1" />
              <line x1="55" y1="140" x2="95" y2="140" stroke="rgba(212,165,71,0.2)" strokeWidth="1" />
              <line x1="105" y1="70" x2="144" y2="80" stroke="rgba(212,165,71,0.25)" strokeWidth="1" />
              <line x1="105" y1="110" x2="144" y2="80" stroke="rgba(212,165,71,0.2)" strokeWidth="1" />
              <line x1="105" y1="110" x2="144" y2="120" stroke="rgba(212,165,71,0.25)" strokeWidth="1" />
              <line x1="105" y1="140" x2="144" y2="120" stroke="rgba(212,165,71,0.2)" strokeWidth="1" />
              <circle cx="150" cy="80" r="6" fill="none" stroke="rgba(212,165,71,0.5)" strokeWidth="1">
                <animate attributeName="r" values="6;16;6" dur="2.5s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0;0.5" dur="2.5s" repeatCount="indefinite" />
              </circle>
            </svg>
          </div>
          <div className={styles.capCardContent}>
            <div>
              <div className={styles.capCardName}>AI Enrichment</div>
              <div className={styles.capCardSub}>Multi-Provider LLM Profiles</div>
            </div>
            <div className={styles.capCardArrow}><ArrowIcon /></div>
          </div>
        </div>

        {/* T&E Reports */}
        <div className={`${styles.capCard} ${styles.vizReports}`}>
          <div className={styles.capCardVisual}>
            <svg width="280" height="200" viewBox="0 0 280 200" fill="none">
              <rect x="80" y="30" width="120" height="150" rx="4" fill="rgba(140,80,200,0.1)" stroke="rgba(140,80,200,0.2)" strokeWidth="1" transform="rotate(3 140 105)" />
              <rect x="80" y="30" width="120" height="150" rx="4" fill="rgba(140,80,200,0.15)" stroke="rgba(140,80,200,0.25)" strokeWidth="1" transform="rotate(-1 140 105)" />
              <rect x="80" y="30" width="120" height="150" rx="4" fill="rgba(20,15,35,0.9)" stroke="rgba(140,80,200,0.3)" strokeWidth="1" />
              <rect x="95" y="50" width="60" height="6" rx="2" fill="rgba(140,80,200,0.4)" />
              <rect x="95" y="65" width="90" height="3" rx="1" fill="rgba(255,255,255,0.1)" />
              <rect x="95" y="75" width="80" height="3" rx="1" fill="rgba(255,255,255,0.08)" />
              <rect x="95" y="85" width="85" height="3" rx="1" fill="rgba(255,255,255,0.08)" />
              <rect x="95" y="100" width="50" height="5" rx="2" fill="rgba(140,80,200,0.3)" />
              <rect x="95" y="112" width="90" height="3" rx="1" fill="rgba(255,255,255,0.08)" />
              <rect x="95" y="122" width="75" height="3" rx="1" fill="rgba(255,255,255,0.08)" />
              <rect x="95" y="132" width="85" height="3" rx="1" fill="rgba(255,255,255,0.08)" />
              <rect x="95" y="148" width="30" height="16" rx="3" fill="rgba(0,212,255,0.2)" stroke="rgba(0,212,255,0.4)" strokeWidth="1" />
              <text x="110" y="159" textAnchor="middle" fill="rgba(0,212,255,0.8)" fontSize="8" fontFamily="monospace">8.4</text>
            </svg>
          </div>
          <div className={styles.capCardContent}>
            <div>
              <div className={styles.capCardName}>T&amp;E Reports</div>
              <div className={styles.capCardSub}>Agent Flow + AI Builder</div>
            </div>
            <div className={styles.capCardArrow}><ArrowIcon /></div>
          </div>
        </div>
      </div>
    </div>
  </section>
);
