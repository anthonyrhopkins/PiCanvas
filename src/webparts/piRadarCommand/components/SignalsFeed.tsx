import * as React from 'react';
import styles from './PiRadarCommand.module.scss';
import { ISignalItem } from './IPiRadarCommandProps';

const ExternalIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" /></svg>
);

interface ISignalsFeedProps {
  signals: ISignalItem[];
}

const tierColors: Record<number, { badge: string; bg: string; textColor: string; label: string }> = {
  5: { badge: styles.badgeT5 || '', bg: 'linear-gradient(135deg, #0a2840 0%, #1a4060 50%, #0a1628 100%)', textColor: 'rgba(0,212,255,0.15)', label: 'SEC' },
  4: { badge: styles.badgeT4 || '', bg: 'linear-gradient(135deg, #1a3a20 0%, #2a5a30 50%, #0a1628 100%)', textColor: 'rgba(0,184,148,0.15)', label: 'M&A' },
  3: { badge: styles.badgeT3 || '', bg: 'linear-gradient(135deg, #2a1a3a 0%, #3a2a5a 50%, #0a1628 100%)', textColor: 'rgba(108,92,231,0.15)', label: 'GOV' },
};

const defaultSignals: ISignalItem[] = [
  {
    title: 'CrowdStrike Expands EMEA Operations With New Berlin Headquarters',
    date: '2/19/2026',
    excerpt: 'SEC filing reveals CrowdStrike\'s commitment to European expansion with a new regional HQ in Berlin, adding 200+ engineering roles across cloud security and AI threat detection.',
    tier: 5,
    eventType: 'expansion',
  },
  {
    title: 'SAP Completes WalkMe Acquisition for $1.5 Billion',
    date: '2/18/2026',
    excerpt: 'SAP finalizes the acquisition of WalkMe, a digital adoption platform, strengthening its Business Technology Platform with advanced user experience analytics and guided workflows.',
    tier: 4,
    eventType: 'merger_acquisition',
  },
  {
    title: 'Palantir Technologies Awarded $480M U.S. Army Contract',
    date: '2/17/2026',
    excerpt: 'Palantir secures a major government contract to deliver AI-powered decision support systems for the U.S. Army\'s next-generation battlefield intelligence platform.',
    tier: 5,
    eventType: 'gov_contract',
  },
];

const eventTypeLabels: Record<string, string> = {
  expansion: 'SEC',
  merger_acquisition: 'M&A',
  gov_contract: 'GOV',
  sec_filing: 'SEC',
  fda_approval: 'FDA',
  patent_grant: 'PAT',
  partnership: 'DEAL',
  product_launch: 'NEW',
};

export const SignalsFeed: React.FC<ISignalsFeedProps> = ({ signals }) => {
  const items = signals.length > 0 ? signals : defaultSignals;

  return (
    <section className={styles.signals} id="signals">
      <div className={styles.signalsHeader}>
        <h2 className={styles.signalsTitle}>Recent Signals</h2>
        <a href="#" className={styles.signalsLink}>
          All Signals <ExternalIcon />
        </a>
      </div>

      {items.map((signal, i) => {
        const tierConfig = tierColors[signal.tier] || tierColors[5];
        const typeLabel = eventTypeLabels[signal.eventType] || signal.eventType.toUpperCase().slice(0, 3);

        return (
          <div className={styles.signalItem} key={i}>
            <div>
              <div className={styles.signalDate}>{signal.date}</div>
              <h3 className={styles.signalHeadline}>{signal.title}</h3>
              <p className={styles.signalExcerpt}>{signal.excerpt}</p>
              <a href="#" className={styles.signalReadmore}>
                Read More <ExternalIcon />
              </a>
            </div>
            <div className={styles.signalImage} style={{ background: tierConfig.bg }}>
              <div className={`${styles.signalTierBadge} ${tierConfig.badge}`}>Tier {signal.tier}</div>
              <svg width="100%" height="100%" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid meet">
                <text x="200" y="130" textAnchor="middle" fill={tierConfig.textColor} fontSize="72" fontWeight="800" fontFamily="sans-serif">{typeLabel}</text>
                {signal.tier === 5 && (
                  <>
                    <circle cx="200" cy="125" r="60" fill="none" stroke="rgba(0,212,255,0.1)" strokeWidth="1" />
                    <circle cx="200" cy="125" r="40" fill="none" stroke="rgba(0,212,255,0.15)" strokeWidth="1" />
                  </>
                )}
              </svg>
            </div>
          </div>
        );
      })}
    </section>
  );
};
