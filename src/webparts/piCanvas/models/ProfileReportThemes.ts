/**
 * ProfileReportThemes — Theme definitions for the Profile Report component.
 * Built-in themes provide defaults; external JSON themes from SharePoint extend the palette.
 */

export interface IProfileReportTheme {
  id: string;
  name: string;
  version: number;
  mode: 'light' | 'dark' | 'high-contrast';
  /** SVG path data for the theme icon in the toggle */
  icon?: string;
  /** Sort order — lower numbers appear first */
  order: number;
  /** Core design tokens (backgrounds, borders, text, accent, status, shadows, fonts) */
  tokens: Record<string, string>;
  /** Optional component-level tokens (badges, search highlight, etc.) */
  componentTokens?: Record<string, string>;
}

/** Core token names — must be present in every theme */
export const CORE_TOKEN_NAMES: readonly string[] = [
  'pr-bg-primary',
  'pr-bg-secondary',
  'pr-bg-tertiary',
  'pr-border-main',
  'pr-border-subtle',
  'pr-text-primary',
  'pr-text-secondary',
  'pr-text-muted',
  'pr-accent-primary',
  'pr-accent-secondary',
  'pr-accent-hover',
  'pr-status-success',
  'pr-status-warning',
  'pr-status-error',
  'pr-status-info',
  'pr-shadow-sm',
  'pr-shadow-md',
  'pr-shadow-lg',
  'pr-font-display',
  'pr-font-body',
  'pr-font-mono'
] as const;

/** Component-level token names — optional, used for badge/search-highlight overrides */
export const COMPONENT_TOKEN_NAMES: readonly string[] = [
  'pr-badge-industry-bg',
  'pr-badge-industry-color',
  'pr-badge-sector-bg',
  'pr-badge-sector-color',
  'pr-badge-owner-bg',
  'pr-badge-owner-color',
  'pr-badge-region-bg',
  'pr-badge-region-color',
  'pr-search-highlight-bg',
  'pr-search-highlight-color'
] as const;

/**
 * Built-in themes — values extracted from existing CSS custom properties in AddTabs.css.
 * These serve as defaults when no external theme JSON files are available.
 */
export const BUILTIN_THEMES: IProfileReportTheme[] = [
  {
    id: 'light',
    name: 'Light',
    version: 1,
    mode: 'light',
    icon: 'M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41',
    order: 10,
    tokens: {
      'pr-bg-primary': '#f5f6f7',
      'pr-bg-secondary': '#ffffff',
      'pr-bg-tertiary': '#eaecee',
      'pr-border-main': '#d1d5db',
      'pr-border-subtle': '#e2e5e9',
      'pr-text-primary': '#1d2d3e',
      'pr-text-secondary': '#354a5f',
      'pr-text-muted': '#687d92',
      'pr-accent-primary': '#0070f2',
      'pr-accent-secondary': '#049f8a',
      'pr-accent-hover': '#0058b8',
      'pr-status-success': '#36a41d',
      'pr-status-warning': '#e76500',
      'pr-status-error': '#ee0000',
      'pr-status-info': '#0070f2',
      'pr-shadow-sm': '0 1px 3px rgba(29, 45, 62, 0.08)',
      'pr-shadow-md': '0 4px 12px rgba(29, 45, 62, 0.10)',
      'pr-shadow-lg': '0 12px 32px rgba(29, 45, 62, 0.14)',
      'pr-font-display': "'72Brand', '72', Arial, Helvetica, sans-serif",
      'pr-font-body': "'72Brand', '72', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      'pr-font-mono': "'72Mono', 'Courier New', Courier, monospace"
    },
    componentTokens: {
      'pr-badge-industry-bg': 'rgba(0, 120, 212, 0.1)',
      'pr-badge-industry-color': '#0078d4',
      'pr-badge-sector-bg': 'rgba(16, 185, 129, 0.1)',
      'pr-badge-sector-color': '#059669',
      'pr-badge-owner-bg': 'rgba(139, 92, 246, 0.1)',
      'pr-badge-owner-color': '#7c3aed',
      'pr-badge-region-bg': 'rgba(245, 158, 11, 0.1)',
      'pr-badge-region-color': '#d97706',
      'pr-search-highlight-bg': 'rgba(0, 112, 242, 0.15)',
      'pr-search-highlight-color': 'inherit'
    }
  },
  {
    id: 'dark',
    name: 'Dark',
    version: 1,
    mode: 'dark',
    icon: 'M13.5 9.5a5.5 5.5 0 0 1-7-7A5.5 5.5 0 1 0 13.5 9.5z',
    order: 20,
    tokens: {
      'pr-bg-primary': '#12171c',
      'pr-bg-secondary': '#1a2330',
      'pr-bg-tertiary': '#223044',
      'pr-border-main': '#2e3e52',
      'pr-border-subtle': '#253347',
      'pr-text-primary': '#edf0f3',
      'pr-text-secondary': '#b8c4d0',
      'pr-text-muted': '#8496a7',
      'pr-accent-primary': '#4fc1ff',
      'pr-accent-secondary': '#54d3b5',
      'pr-accent-hover': '#7dd4ff',
      'pr-status-success': '#5dc122',
      'pr-status-warning': '#ffc933',
      'pr-status-error': '#ff5c77',
      'pr-status-info': '#4fc1ff',
      'pr-shadow-sm': '0 1px 3px rgba(0, 0, 0, 0.30)',
      'pr-shadow-md': '0 4px 12px rgba(0, 0, 0, 0.40)',
      'pr-shadow-lg': '0 12px 32px rgba(0, 0, 0, 0.50)',
      'pr-font-display': "'72Brand', '72', Arial, Helvetica, sans-serif",
      'pr-font-body': "'72Brand', '72', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      'pr-font-mono': "'72Mono', 'Courier New', Courier, monospace"
    },
    componentTokens: {
      'pr-badge-industry-bg': 'rgba(56, 189, 248, 0.15)',
      'pr-badge-industry-color': '#38bdf8',
      'pr-badge-sector-bg': 'rgba(52, 211, 153, 0.15)',
      'pr-badge-sector-color': '#34d399',
      'pr-badge-owner-bg': 'rgba(167, 139, 250, 0.15)',
      'pr-badge-owner-color': '#a78bfa',
      'pr-badge-region-bg': 'rgba(251, 191, 36, 0.15)',
      'pr-badge-region-color': '#fbbf24',
      'pr-search-highlight-bg': 'rgba(79, 193, 255, 0.25)',
      'pr-search-highlight-color': 'inherit'
    }
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    version: 1,
    mode: 'high-contrast',
    icon: 'M8 2a6 6 0 0 0 0 12z',
    order: 30,
    tokens: {
      'pr-bg-primary': '#000000',
      'pr-bg-secondary': '#0a0a0a',
      'pr-bg-tertiary': '#1a1a1a',
      'pr-border-main': '#ffffff',
      'pr-border-subtle': '#cccccc',
      'pr-text-primary': '#ffffff',
      'pr-text-secondary': '#f0f0f0',
      'pr-text-muted': '#cccccc',
      'pr-accent-primary': '#54d8ff',
      'pr-accent-secondary': '#5fffb5',
      'pr-accent-hover': '#8ae4ff',
      'pr-status-success': '#5fffb5',
      'pr-status-warning': '#ffd633',
      'pr-status-error': '#ff6680',
      'pr-status-info': '#54d8ff',
      'pr-shadow-sm': '0 0 0 1px #ffffff',
      'pr-shadow-md': '0 0 0 1px #ffffff',
      'pr-shadow-lg': '0 0 0 2px #ffffff',
      'pr-font-display': "'72Brand', '72', Arial, Helvetica, sans-serif",
      'pr-font-body': "'72Brand', '72', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      'pr-font-mono': "'72Mono', 'Courier New', Courier, monospace"
    },
    componentTokens: {
      'pr-badge-industry-bg': 'rgba(84, 216, 255, 0.2)',
      'pr-badge-industry-color': '#54d8ff',
      'pr-badge-sector-bg': 'rgba(95, 255, 181, 0.2)',
      'pr-badge-sector-color': '#5fffb5',
      'pr-badge-owner-bg': 'rgba(167, 139, 250, 0.2)',
      'pr-badge-owner-color': '#c4b5fd',
      'pr-badge-region-bg': 'rgba(255, 214, 51, 0.2)',
      'pr-badge-region-color': '#ffd633',
      'pr-search-highlight-bg': '#ffd633',
      'pr-search-highlight-color': '#000000'
    }
  }
];
