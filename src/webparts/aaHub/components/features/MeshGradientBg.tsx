import * as React from 'react';

interface IMeshGradientBgProps {
  className?: string;
}

/**
 * CSS-only animated mesh gradient background.
 * Replaces pispace.dev's @paper-design/shaders-react MeshGradient
 * (which requires React 18+) with layered radial gradients + keyframes.
 */
export const MeshGradientBg: React.FC<IMeshGradientBgProps> = ({ className = '' }) => {
  // Check reduced motion preference
  const prefersReducedMotion = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    zIndex: 0,
    background: 'var(--hub-bg, #12171C)',
  };

  const baseOrbStyle: React.CSSProperties = {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(80px)',
    opacity: 0.6,
    willChange: prefersReducedMotion ? 'auto' : 'transform, opacity',
  };

  return (
    <div className={className} style={containerStyle} aria-hidden="true">
      {/* Primary gradient backdrop — uses CSS var so it adapts to light/dark/hc */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--hub-bg, #12171C)',
      }} />

      {/* Animated orb 1 — large blue */}
      <div style={{
        ...baseOrbStyle,
        width: '60vw',
        height: '60vw',
        maxWidth: '800px',
        maxHeight: '800px',
        top: '-10%',
        left: '-10%',
        background: 'radial-gradient(circle, hsla(207, 90%, 54%, 0.4) 0%, transparent 70%)',
        animation: prefersReducedMotion ? 'none' : 'meshPulse 12s ease-in-out infinite',
      }} />

      {/* Animated orb 2 — purple accent */}
      <div style={{
        ...baseOrbStyle,
        width: '50vw',
        height: '50vw',
        maxWidth: '650px',
        maxHeight: '650px',
        top: '30%',
        right: '-15%',
        background: 'radial-gradient(circle, hsla(260, 60%, 50%, 0.3) 0%, transparent 70%)',
        animation: prefersReducedMotion ? 'none' : 'meshPulse 15s ease-in-out infinite 2s',
      }} />

      {/* Animated orb 3 — teal glow */}
      <div style={{
        ...baseOrbStyle,
        width: '45vw',
        height: '45vw',
        maxWidth: '600px',
        maxHeight: '600px',
        bottom: '-5%',
        left: '20%',
        background: 'radial-gradient(circle, hsla(190, 80%, 45%, 0.25) 0%, transparent 70%)',
        animation: prefersReducedMotion ? 'none' : 'meshPulse 18s ease-in-out infinite 4s',
      }} />

      {/* Subtle noise texture overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        backgroundSize: '128px 128px',
      }} />

      {/* Global keyframe injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes meshPulse {
          0%, 100% { opacity: 0.6; transform: scale(1) translate(0, 0); }
          25% { opacity: 0.8; transform: scale(1.08) translate(2%, -2%); }
          50% { opacity: 1; transform: scale(1.05) translate(-1%, 3%); }
          75% { opacity: 0.7; transform: scale(0.97) translate(3%, 1%); }
        }
      `}} />
    </div>
  );
};
