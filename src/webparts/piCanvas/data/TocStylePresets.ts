/**
 * TocStylePresets — Six built-in style presets for the Table of Contents.
 * Each preset is a Partial<ITocConfig> that batch-sets typography, colors, spacing, and interactions.
 */
import { ITocConfig } from '../services/TocService';

export type TocPresetKey = 'classic' | 'modern' | 'sidebar' | 'minimal' | 'elegant' | 'compact';

export interface ITocPresetInfo {
  key: TocPresetKey;
  label: string;
  description: string;
  config: Partial<ITocConfig>;
}

export const TOC_STYLE_PRESETS: ITocPresetInfo[] = [
  {
    key: 'classic',
    label: 'Classic',
    description: 'Traditional indented TOC with bullets',
    config: {
      fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, sans-serif',
      baseFontSize: 14,
      titleFontSize: 16,
      levelSizeStep: 1,
      titleFontWeight: '600',
      h2FontWeight: '600',
      subHeadingFontWeight: '400',
      lineHeight: 1.6,
      letterSpacing: 0,
      linkColor: '#0078d4',
      linkHoverColor: '#106ebe',
      activeColor: '#005a9e',
      titleColor: '#323130',
      levelColorDimming: 10,
      backgroundColor: '',
      borderColor: '',
      containerPadding: 16,
      itemSpacing: 4,
      indentPerLevel: 20,
      maxWidth: '',
      listStyle: 'disc',
      customIcon: '',
      enableScrollspy: true,
      enableCollapsible: false,
      enableHoverBackground: false,
      hoverBackgroundColor: '',
      enableClickRipple: false
    }
  },
  {
    key: 'modern',
    label: 'Modern',
    description: 'Flat design with hover backgrounds and accent active states',
    config: {
      fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif',
      baseFontSize: 14,
      titleFontSize: 15,
      levelSizeStep: 0,
      titleFontWeight: '700',
      h2FontWeight: '500',
      subHeadingFontWeight: '400',
      lineHeight: 1.5,
      letterSpacing: 0,
      linkColor: '#1a1a2e',
      linkHoverColor: '#0078d4',
      activeColor: '#0078d4',
      titleColor: '#1a1a2e',
      levelColorDimming: 5,
      backgroundColor: '',
      borderColor: '',
      containerPadding: 12,
      itemSpacing: 2,
      indentPerLevel: 16,
      maxWidth: '',
      listStyle: 'none',
      customIcon: '',
      enableScrollspy: true,
      enableCollapsible: false,
      enableHoverBackground: true,
      hoverBackgroundColor: 'rgba(0, 120, 212, 0.06)',
      enableClickRipple: true
    }
  },
  {
    key: 'sidebar',
    label: 'Sidebar',
    description: 'Background panel with left border accent',
    config: {
      fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
      baseFontSize: 13,
      titleFontSize: 11,
      levelSizeStep: 0,
      titleFontWeight: '700',
      h2FontWeight: '500',
      subHeadingFontWeight: '400',
      lineHeight: 1.5,
      letterSpacing: 0.5,
      linkColor: '#323130',
      linkHoverColor: '#0078d4',
      activeColor: '#0078d4',
      titleColor: '#605e5c',
      levelColorDimming: 8,
      backgroundColor: '#faf9f8',
      borderColor: '#edebe9',
      containerPadding: 16,
      itemSpacing: 2,
      indentPerLevel: 14,
      maxWidth: '',
      listStyle: 'none',
      customIcon: '',
      enableScrollspy: true,
      enableCollapsible: false,
      enableHoverBackground: true,
      hoverBackgroundColor: 'rgba(0, 0, 0, 0.04)',
      enableClickRipple: false
    }
  },
  {
    key: 'minimal',
    label: 'Minimal',
    description: 'Ultra-clean with large line-height',
    config: {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      baseFontSize: 14,
      titleFontSize: 13,
      levelSizeStep: 0,
      titleFontWeight: '600',
      h2FontWeight: '400',
      subHeadingFontWeight: '400',
      lineHeight: 2.0,
      letterSpacing: 0,
      linkColor: '#323130',
      linkHoverColor: '#0078d4',
      activeColor: '#0078d4',
      titleColor: '#a19f9d',
      levelColorDimming: 5,
      backgroundColor: '',
      borderColor: '',
      containerPadding: 16,
      itemSpacing: 0,
      indentPerLevel: 16,
      maxWidth: '',
      listStyle: 'none',
      customIcon: '',
      enableScrollspy: true,
      enableCollapsible: false,
      enableHoverBackground: false,
      hoverBackgroundColor: '',
      enableClickRipple: false
    }
  },
  {
    key: 'elegant',
    label: 'Elegant',
    description: 'Serif font with roman numerals and decorative accent',
    config: {
      fontFamily: 'Georgia, "Times New Roman", serif',
      baseFontSize: 15,
      titleFontSize: 18,
      levelSizeStep: 1,
      titleFontWeight: '600',
      h2FontWeight: '600',
      subHeadingFontWeight: '400',
      lineHeight: 1.8,
      letterSpacing: 0.3,
      linkColor: '#5c2d91',
      linkHoverColor: '#8661c5',
      activeColor: '#5c2d91',
      titleColor: '#5c2d91',
      levelColorDimming: 12,
      backgroundColor: '',
      borderColor: '#5c2d91',
      containerPadding: 20,
      itemSpacing: 6,
      indentPerLevel: 24,
      maxWidth: '',
      listStyle: 'roman',
      customIcon: '',
      enableScrollspy: true,
      enableCollapsible: false,
      enableHoverBackground: false,
      hoverBackgroundColor: '',
      enableClickRipple: false
    }
  },
  {
    key: 'compact',
    label: 'Compact',
    description: 'Dense layout for long documents',
    config: {
      fontFamily: '"Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
      baseFontSize: 12,
      titleFontSize: 12,
      levelSizeStep: 0,
      titleFontWeight: '700',
      h2FontWeight: '500',
      subHeadingFontWeight: '400',
      lineHeight: 1.4,
      letterSpacing: 0,
      linkColor: '#0078d4',
      linkHoverColor: '#106ebe',
      activeColor: '#005a9e',
      titleColor: '#605e5c',
      levelColorDimming: 8,
      backgroundColor: '',
      borderColor: '',
      containerPadding: 8,
      itemSpacing: 0,
      indentPerLevel: 12,
      maxWidth: '',
      listStyle: 'none',
      customIcon: '',
      enableScrollspy: false,
      enableCollapsible: false,
      enableHoverBackground: false,
      hoverBackgroundColor: '',
      enableClickRipple: false
    }
  }
];

/**
 * Get a preset config by key
 */
export function getTocPreset(key: TocPresetKey): Partial<ITocConfig> | undefined {
  const preset = TOC_STYLE_PRESETS.find(p => p.key === key);
  return preset ? preset.config : undefined;
}
