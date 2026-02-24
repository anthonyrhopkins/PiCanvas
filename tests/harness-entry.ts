/**
 * Test harness entry point — creates a ConfigurationPanel with mock callbacks
 * and exposes it on `window` for Playwright tests.
 */
import { ConfigurationPanel, IConfigurationPanelOptions } from '../src/webparts/piCanvas/configPanel/ConfigurationPanel';

// ── Mock property store ──
const properties: Record<string, string | number | boolean | undefined> = {
  tabCount: 3,
  tabStyle: 'default',
  tabAlignment: 'stretch',
  tabOrientation: 'horizontal',
  verticalTabPosition: 'left',
  verticalTabWidth: '200px',
  labelImageHeight: '60px',
  themeMode: 'auto',
  accentColor: '#0078d4',
  tabTextColor: '#323130',
  tabActiveTextColor: '#0078d4',
  tabBackgroundColor: '#ffffff',
  tabActiveBackgroundColor: '#f3f2f1',
  tabHoverBackgroundColor: '#f5f5f5',
  tabFontSize: 14,
  tabFontWeight: 400,
  tabPaddingVertical: 8,
  tabPaddingHorizontal: 16,
  tabGap: 0,
  tabContentGap: 0,
  tabBorderRadius: 4,
  activeIndicatorWidth: 2,
  tabShadow: 'none',
  enableTransitions: true,
  showActiveIndicator: true,
  activeIndicatorColor: '#0078d4',
  showTabSeparator: false,
  tabSeparatorColor: '#e1dfdd',
  enableDeepLinking: true,
  enableLazyLoading: true,
  enableFullWidthFix: true,
  sectionClass: '',
  webpartClass: '',
  lockDefaultTemplateEnabled: false,
  lockDefaultTemplate: '',
  lockDefaultMessagesEnabled: false,
  lockDefaultMessagePrompt: '',
  lockDefaultMessageError: '',
  lockDefaultMessageMissing: '',
  lockDefaultMessageSuccess: '',
  lockUnlockTtlMinutes: 30,
  // Tab 1
  tab1Title: 'Overview',
  tab1Label: 'Overview',
  tab1ContentType: 'webpart',
  tab1Icon: '',
  tab1Zone: '',
  tab1Section: '',
  tab1HtmlContent: '',
  tab1MarkdownContent: '',
  tab1EmbedUrl: '',
  tab1RssUrl: '',
  tab1FileUrl: '',
  tab1JavaScriptCode: '',
  tab1Visible: true,
  tab1PasswordEnabled: false,
  tab1Password: '',
  // Tab 2
  tab2Title: 'Details',
  tab2Label: 'Details',
  tab2ContentType: 'section',
  tab2Icon: '',
  tab2Zone: '',
  tab2Section: '',
  tab2HtmlContent: '',
  tab2MarkdownContent: '',
  tab2EmbedUrl: '',
  tab2RssUrl: '',
  tab2FileUrl: '',
  tab2JavaScriptCode: '',
  tab2Visible: true,
  tab2PasswordEnabled: false,
  tab2Password: '',
  // Tab 3
  tab3Title: 'Resources',
  tab3Label: 'Resources',
  tab3ContentType: 'html',
  tab3Icon: '',
  tab3Zone: '',
  tab3Section: '',
  tab3HtmlContent: '<p>Hello World</p>',
  tab3MarkdownContent: '',
  tab3EmbedUrl: '',
  tab3RssUrl: '',
  tab3FileUrl: '',
  tab3JavaScriptCode: '',
  tab3Visible: true,
  tab3PasswordEnabled: false,
  tab3Password: '',
};

// ── Action log for test assertions ──
const actionLog: string[] = [];

const TAB_SUFFIXES = [
  'Title', 'Label', 'ContentType', 'Icon', 'Zone', 'Section',
  'HtmlContent', 'MarkdownContent', 'EmbedUrl', 'RssUrl',
  'FileUrl', 'JavaScriptCode', 'Visible', 'PasswordEnabled', 'Password'
];

const options: IConfigurationPanelOptions = {
  getProperty: (key: string) => properties[key],
  setProperty: (key: string, value: string | number | boolean | undefined) => {
    properties[key] = value;
  },
  setProperties: (updates: Record<string, string | number | boolean | undefined>) => {
    Object.assign(properties, updates);
  },
  reRender: () => { actionLog.push('reRender'); },
  refreshPropertyPane: () => { actionLog.push('refreshPropertyPane'); },
  getTabCount: () => (properties.tabCount as number) || 2,
  addTab: () => {
    const count = (properties.tabCount as number) || 2;
    if (count < 20) {
      properties.tabCount = count + 1;
      const i = count + 1;
      properties[`tab${i}Title`] = `Tab ${i}`;
      properties[`tab${i}ContentType`] = 'webpart';
      properties[`tab${i}Visible`] = true;
    }
    actionLog.push('addTab');
  },
  deleteTab: (index: number) => {
    const count = (properties.tabCount as number) || 2;
    if (count > 1) {
      // Shift tabs down
      for (let i = index; i < count; i++) {
        TAB_SUFFIXES.forEach(s => {
          properties[`tab${i}${s}`] = properties[`tab${i + 1}${s}`];
        });
      }
      // Clear last
      TAB_SUFFIXES.forEach(s => { delete properties[`tab${count}${s}`]; });
      properties.tabCount = count - 1;
    }
    actionLog.push(`deleteTab:${index}`);
  },
  moveTabUp: (index: number) => { actionLog.push(`moveTabUp:${index}`); },
  moveTabDown: (index: number) => { actionLog.push(`moveTabDown:${index}`); },
  duplicateTab: (index: number) => {
    const count = (properties.tabCount as number) || 2;
    if (count < 20) {
      const newIndex = count + 1;
      properties.tabCount = newIndex;
      TAB_SUFFIXES.forEach(s => {
        properties[`tab${newIndex}${s}`] = properties[`tab${index}${s}`];
      });
      properties[`tab${newIndex}Title`] = `${properties[`tab${index}Title`]} (Copy)`;
    }
    actionLog.push(`duplicateTab:${index}`);
  },
  getZones: () => [
    ['zone-1', 'Zone 1', 1],
    ['zone-2', 'Zone 2', 2]
  ],
  getSections: () => [
    ['section-1', 'Section 1 - Full Width', 1],
    ['section-2', 'Section 2 - Two Columns', 2]
  ],
  getTextWebPartOptions: () => [
    { key: 'twp-1', text: 'Text Block: Welcome' },
    { key: 'twp-2', text: 'Text Block: FAQ' }
  ],
  getTemplates: () => [
    { id: 'dashboard', name: 'Dashboard', description: 'Modern dashboard layout', isBuiltIn: true },
    { id: 'documentation', name: 'Documentation', description: 'Technical docs', isBuiltIn: true },
    { id: 'team-site', name: 'Team Site', description: 'Collaborative team site', isBuiltIn: true },
    { id: 'my-custom', name: 'My Custom Template', description: 'Custom saved template', isBuiltIn: false }
  ],
  applyTemplate: (id: string) => { actionLog.push(`applyTemplate:${id}`); },
  exportConfig: () => { actionLog.push('exportConfig'); },
  importConfig: () => { actionLog.push('importConfig'); },
  saveAsTemplate: () => { actionLog.push('saveAsTemplate'); },
  getThemePresets: () => [
    {
      id: 'dashboard', name: 'Dashboard',
      accentColor: '#0078d4', tabStyle: 'pills',
      properties: { accentColor: '#0078d4', tabTextColor: '#323130', tabActiveTextColor: '#ffffff', tabBackgroundColor: '#f3f2f1', tabActiveBackgroundColor: '#0078d4' }
    },
    {
      id: 'documentation', name: 'Documentation',
      accentColor: '#107c10',
      properties: { accentColor: '#107c10', tabTextColor: '#323130', tabActiveTextColor: '#107c10', tabBackgroundColor: '#ffffff', tabActiveBackgroundColor: '#f3f2f1' }
    }
  ],
  resetAllStyles: () => {
    properties.tabStyle = 'default';
    properties.accentColor = '#0078d4';
    properties.tabFontSize = 14;
    actionLog.push('resetAllStyles');
  },
  maxTabs: 20,
  tabPropertySuffixes: TAB_SUFFIXES
};

// ── Expose to window for Playwright ──
(window as any).__picanvas = {
  panel: null as ConfigurationPanel | null,
  options,
  properties,
  actionLog,
  openPanel: () => {
    const panel = new ConfigurationPanel(options);
    (window as any).__picanvas.panel = panel;
    panel.open();
    return panel;
  },
  closePanel: (save: boolean) => {
    const panel = (window as any).__picanvas.panel;
    if (panel) {
      panel.close(save);
      (window as any).__picanvas.panel = null;
    }
  },
  getProperty: (key: string) => properties[key],
  getActionLog: () => [...actionLog],
  clearActionLog: () => { actionLog.length = 0; }
};
