import * as React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Button } from '../ui/Button';
import { ThemeMode } from '../../models/types';

const barStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '8px 16px',
  background: 'rgba(0, 0, 0, 0.3)',
  backdropFilter: 'blur(8px)',
  borderTop: '1px solid rgba(255,255,255,0.06)',
  fontSize: '12px',
  flexWrap: 'wrap',
};

const labelStyle: React.CSSProperties = {
  color: 'var(--aahub-muted-fg)',
  fontWeight: 600,
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const sepStyle: React.CSSProperties = {
  width: '1px',
  height: '16px',
  background: 'rgba(255,255,255,0.12)',
  margin: '0 4px',
};

const sliderStyle: React.CSSProperties = {
  width: '100px',
  accentColor: 'var(--aahub-primary)',
  cursor: 'pointer',
};

interface IThemeButtonProps {
  mode: ThemeMode;
  label: string;
  current: ThemeMode;
  onClick: (mode: ThemeMode) => void;
}

const ThemeButton: React.FC<IThemeButtonProps> = ({ mode, label, current, onClick }) => {
  const isActive = current === mode;
  return (
    <Button
      variant={isActive ? 'primary' : 'ghost'}
      size="sm"
      onClick={() => onClick(mode)}
      aria-pressed={isActive}
      style={{
        fontSize: '11px',
        height: '26px',
        padding: '0 10px',
        ...(isActive ? {} : { color: 'var(--aahub-muted-fg)' }),
      }}
    >
      {label}
    </Button>
  );
};

export const AccessibilityBar: React.FC = () => {
  const { theme, setMode, setFontSize, toggleBadges } = useTheme();

  const handleSliderChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFontSize(parseInt(e.target.value, 10));
  }, [setFontSize]);

  return (
    <div style={barStyle} role="toolbar" aria-label="Display settings">
      <span style={labelStyle}>Theme</span>
      <ThemeButton mode="dark" label="Dark" current={theme.mode} onClick={setMode} />
      <ThemeButton mode="light" label="Light" current={theme.mode} onClick={setMode} />
      <ThemeButton mode="hc" label="Hi-Con" current={theme.mode} onClick={setMode} />

      <span style={sepStyle} role="separator" />

      <span style={labelStyle}>Size</span>
      <span style={{ color: 'var(--aahub-fg)', minWidth: '20px', textAlign: 'center' as const }} aria-live="polite">
        {theme.fontSize}
      </span>
      <input
        type="range"
        min={10}
        max={20}
        value={theme.fontSize}
        step={1}
        onChange={handleSliderChange}
        style={sliderStyle}
        aria-label="Font size"
        title="Adjust font size"
      />

      <span style={sepStyle} role="separator" />

      <Button
        variant={theme.showBadges ? 'primary' : 'ghost'}
        size="sm"
        onClick={toggleBadges}
        aria-pressed={theme.showBadges}
        style={{
          fontSize: '11px',
          height: '26px',
          padding: '0 10px',
          ...(theme.showBadges ? {} : { color: 'var(--aahub-muted-fg)' }),
        }}
      >
        NEW {theme.showBadges ? '\u2713' : '\u2717'}
      </Button>
    </div>
  );
};
