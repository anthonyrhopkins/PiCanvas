import * as React from 'react';
import type { IAAHubAppProps } from '../models/types';
import { ServiceContext, IServiceContext } from '../contexts/ServiceContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { Banner } from './layout/Banner';
import { NavBar } from './layout/NavBar';
import { HeroSection } from './layout/HeroSection';
import { AccessibilityBar } from './layout/AccessibilityBar';
import { MeshGradientBg } from './features/MeshGradientBg';
import { useNavigation } from '../hooks/useNavigation';
import styles from '../AAHubWebPart.module.scss';

/**
 * AAHubApp — Root React component for the Architecture Advisory Hub.
 * Composes providers → layout → sections.
 */
export const AAHubApp: React.FC<IAAHubAppProps> = (props) => {
  const rootRef = React.useRef<HTMLDivElement>(null);

  const serviceValue: IServiceContext = React.useMemo(() => ({
    spHttpClient: props.spHttpClient,
    siteUrl: props.siteUrl,
    isWorkbench: props.isWorkbench,
  }), [props.spHttpClient, props.siteUrl, props.isWorkbench]);

  return (
    <ServiceContext.Provider value={serviceValue}>
      <ThemeProvider rootElement={rootRef.current}>
        <AAHubShell
          ref={rootRef}
          siteTitle={props.siteTitle}
          siteIconUrl={props.siteIconUrl}
        />
      </ThemeProvider>
    </ServiceContext.Provider>
  );
};

// Inner shell — needs ThemeProvider to be above it for useTheme()
interface IShellProps {
  siteTitle: string;
  siteIconUrl: string;
}

const AAHubShell = React.forwardRef<HTMLDivElement, IShellProps>(
  ({ siteTitle, siteIconUrl }, ref) => {
    const { theme } = useTheme();
    const innerRef = React.useRef<HTMLDivElement>(null);

    // Merge forwarded ref with internal ref
    React.useEffect(() => {
      if (typeof ref === 'function') {
        ref(innerRef.current);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = innerRef.current;
      }
    }, [ref]);

    // Re-trigger theme application when ref becomes available
    React.useEffect(() => {
      if (innerRef.current) {
        // Force re-apply by nudging the provider's rootElement
        // The ThemeProvider reads rootElement from props,
        // so we set classes directly here for the initial render
        const el = innerRef.current;
        el.classList.remove('theme-light', 'theme-hc');
        if (theme.mode === 'light') el.classList.add('theme-light');
        if (theme.mode === 'hc') el.classList.add('theme-hc');
        el.style.setProperty('--aahub-fs', String(theme.fontSize));
        el.style.fontSize = `calc(var(--aahub-fs, 13) * 1px)`;
      }
    }, [theme.mode, theme.fontSize]);

    const { nodes, loading: navLoading } = useNavigation();

    return (
      <div ref={innerRef} className={styles.aaHub}>
        {/* Animated mesh gradient background */}
        <MeshGradientBg />

        {/* Site banner with mega-menu navigation */}
        <Banner title={siteTitle} iconUrl={siteIconUrl || undefined}>
          <NavBar
            nodes={nodes}
            loading={navLoading}
            showBadges={theme.showBadges}
          />
        </Banner>

        {/* Hero content area */}
        <HeroSection showBadges={theme.showBadges} />

        {/* Accessibility toolbar (theme, font size, badges) */}
        <AccessibilityBar />
      </div>
    );
  }
);

AAHubShell.displayName = 'AAHubShell';
