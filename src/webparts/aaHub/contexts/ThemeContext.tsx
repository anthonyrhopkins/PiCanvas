import * as React from 'react';
import { ThemeMode, IThemeState } from '../models/types';

interface IThemeContext {
  theme: IThemeState;
  setMode: (mode: ThemeMode) => void;
  setFontSize: (size: number) => void;
  toggleBadges: () => void;
}

const defaultTheme: IThemeState = {
  mode: 'dark',
  fontSize: 13,
  showBadges: true,
};

const ThemeContext = React.createContext<IThemeContext>({
  theme: defaultTheme,
  setMode: () => undefined,
  setFontSize: () => undefined,
  toggleBadges: () => undefined,
});

export const useTheme = (): IThemeContext => React.useContext(ThemeContext);

interface IThemeProviderProps {
  children: React.ReactNode;
  rootElement: HTMLElement | null;
}

export const ThemeProvider: React.FC<IThemeProviderProps> = ({ children, rootElement }) => {
  const [theme, setTheme] = React.useState<IThemeState>(() => {
    try {
      const saved = localStorage.getItem('aahub-theme');
      if (saved) {
        return { ...defaultTheme, ...JSON.parse(saved) };
      }
    } catch { /* ignore */ }
    return defaultTheme;
  });

  // Apply theme class + CSS variables to root element
  React.useEffect(() => {
    if (!rootElement) return;

    rootElement.classList.remove('theme-light', 'theme-hc');
    if (theme.mode === 'light') rootElement.classList.add('theme-light');
    if (theme.mode === 'hc') rootElement.classList.add('theme-hc');

    rootElement.style.setProperty('--aahub-fs', String(theme.fontSize));
    rootElement.style.fontSize = `calc(var(--aahub-fs, 13) * 1px)`;
  }, [theme.mode, theme.fontSize, rootElement]);

  // Persist to localStorage
  React.useEffect(() => {
    try {
      localStorage.setItem('aahub-theme', JSON.stringify(theme));
    } catch { /* ignore */ }
  }, [theme]);

  const setMode = React.useCallback((mode: ThemeMode) => {
    setTheme(prev => ({ ...prev, mode }));
  }, []);

  const setFontSize = React.useCallback((fontSize: number) => {
    setTheme(prev => ({ ...prev, fontSize: Math.max(10, Math.min(20, fontSize)) }));
  }, []);

  const toggleBadges = React.useCallback(() => {
    setTheme(prev => ({ ...prev, showBadges: !prev.showBadges }));
  }, []);

  const value = React.useMemo(() => ({ theme, setMode, setFontSize, toggleBadges }), [theme, setMode, setFontSize, toggleBadges]);

  return React.createElement(ThemeContext.Provider, { value }, children);
};
