import * as React from 'react';

const DOT_COUNT = 35;

interface Dot {
  x: number;
  y: number;
  r: number;
  alpha: number;
  maxAlpha: number;
  angle: number;
  decay: number;
}

export const RadarCanvas: React.FC = () => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animRef = React.useRef<number>(0);
  const stateRef = React.useRef<{
    dots: Dot[];
    angle: number;
    w: number;
    h: number;
    cx: number;
    cy: number;
    radius: number;
  }>({ dots: [], angle: 0, w: 0, h: 0, cx: 0, cy: 0, radius: 0 });

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const state = stateRef.current;

    function resize(): void {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      state.w = rect.width;
      state.h = rect.height;
      state.cx = rect.width / 2;
      state.cy = rect.height / 2;
      state.radius = Math.min(state.cx, state.cy) * 0.7;
      initDots();
    }

    function initDots(): void {
      state.dots = [];
      for (let i = 0; i < DOT_COUNT; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * state.radius * 0.95;
        state.dots.push({
          x: state.cx + Math.cos(a) * r,
          y: state.cy + Math.sin(a) * r,
          r: 1.5 + Math.random() * 2.5,
          alpha: 0,
          maxAlpha: 0.3 + Math.random() * 0.5,
          angle: a,
          decay: 0.003 + Math.random() * 0.005,
        });
      }
    }

    function draw(): void {
      const c = ctx!;
      const { cx, cy, radius, dots } = state;
      c.clearRect(0, 0, state.w, state.h);

      // Background gradient
      const bg = c.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.5);
      bg.addColorStop(0, 'rgba(0, 30, 50, 0.4)');
      bg.addColorStop(0.5, 'rgba(10, 14, 23, 0.6)');
      bg.addColorStop(1, 'rgba(10, 14, 23, 0.95)');
      c.fillStyle = bg;
      c.fillRect(0, 0, state.w, state.h);

      // Concentric rings
      for (let i = 1; i <= 5; i++) {
        c.beginPath();
        c.arc(cx, cy, radius * (i / 5), 0, Math.PI * 2);
        c.strokeStyle = `rgba(0, 212, 255, ${0.04 + i * 0.01})`;
        c.lineWidth = 1;
        c.stroke();
      }

      // Cross lines
      c.strokeStyle = 'rgba(0, 212, 255, 0.04)';
      c.beginPath();
      c.moveTo(cx - radius, cy);
      c.lineTo(cx + radius, cy);
      c.moveTo(cx, cy - radius);
      c.lineTo(cx, cy + radius);
      c.stroke();

      // Sweep
      state.angle += 0.008;
      const sweepX = cx + Math.cos(state.angle) * radius;
      const sweepY = cy + Math.sin(state.angle) * radius;

      // Sweep line
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(sweepX, sweepY);
      c.strokeStyle = 'rgba(0, 212, 255, 0.35)';
      c.lineWidth = 1.5;
      c.stroke();

      // Sweep trail
      c.beginPath();
      c.moveTo(cx, cy);
      c.arc(cx, cy, radius, state.angle - 0.5, state.angle);
      c.closePath();
      const trailGrad = c.createRadialGradient(cx, cy, 0, cx, cy, radius);
      trailGrad.addColorStop(0, 'rgba(0, 212, 255, 0.08)');
      trailGrad.addColorStop(1, 'rgba(0, 212, 255, 0.02)');
      c.fillStyle = trailGrad;
      c.fill();

      // Dots
      dots.forEach(dot => {
        const dotAngle = Math.atan2(dot.y - cy, dot.x - cx);
        const diff = ((state.angle % (Math.PI * 2)) - ((dotAngle + Math.PI * 2) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        if (diff < 0.15) {
          dot.alpha = dot.maxAlpha;
        } else {
          dot.alpha = Math.max(0, dot.alpha - dot.decay);
        }
        if (dot.alpha > 0.01) {
          c.beginPath();
          c.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
          c.fillStyle = `rgba(0, 212, 255, ${dot.alpha})`;
          c.fill();
          c.beginPath();
          c.arc(dot.x, dot.y, dot.r * 3, 0, Math.PI * 2);
          c.fillStyle = `rgba(0, 212, 255, ${dot.alpha * 0.15})`;
          c.fill();
        }
      });

      // Center dot
      c.beginPath();
      c.arc(cx, cy, 4, 0, Math.PI * 2);
      c.fillStyle = 'rgba(0, 212, 255, 0.8)';
      c.fill();
      c.beginPath();
      c.arc(cx, cy, 8, 0, Math.PI * 2);
      c.fillStyle = 'rgba(0, 212, 255, 0.15)';
      c.fill();

      animRef.current = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
};
