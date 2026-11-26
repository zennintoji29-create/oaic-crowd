import React, { useEffect, useRef } from 'react';

interface ParticlesFieldProps {
  className?: string;
  count?: number;
  color?: string;
}

export const ParticlesField: React.FC<ParticlesFieldProps> = ({
  className = '',
  count = 28,
  color = 'rgba(24, 226, 153, 0.45)'
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const particleCount = window.innerWidth < 640 ? Math.min(14, count) : count;
    let width = 1;
    let height = 1;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      const ctx = canvas.getContext('2d');
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(parent);

    const particles = Array.from({ length: particleCount }, (_, idx) => ({
      x: ((idx * 97) % 100) / 100 * width,
      y: ((idx * 53) % 100) / 100 * height,
      r: 1 + (idx % 3) * 0.65,
      vx: ((idx % 2 === 0 ? 1 : -1) * (0.12 + (idx % 5) * 0.04)),
      vy: -(0.14 + (idx % 4) * 0.05)
    }));

    let rafId = 0;
    const render = () => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = color;
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y < -8) p.y = height + 8;
          if (p.x < -8) p.x = width + 8;
          if (p.x > width + 8) p.x = -8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(rafId);
      ro?.disconnect();
    };
  }, [count, color]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 w-full h-full ${className}`}
    />
  );
};
