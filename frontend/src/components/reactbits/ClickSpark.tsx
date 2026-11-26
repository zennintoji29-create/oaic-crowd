import React, { useEffect, useRef } from 'react';

interface Spark {
  x: number;
  y: number;
  angle: number;
  startTime: number;
}

interface ClickSparkProps {
  children: React.ReactNode;
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  durationMs?: number;
  className?: string;
}

export const ClickSpark: React.FC<ClickSparkProps> = ({
  children,
  sparkColor = '#18e299',
  sparkSize = 9,
  sparkRadius = 18,
  sparkCount = 8,
  durationMs = 380,
  className = ''
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sparksRef = useRef<Spark[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const ctx = canvas.getContext('2d');
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(wrapper);

    let rafId = 0;
    const render = (now: number) => {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const rect = wrapper.getBoundingClientRect();
        ctx.clearRect(0, 0, rect.width, rect.height);
        sparksRef.current = sparksRef.current.filter((spark) => {
          const elapsed = now - spark.startTime;
          if (elapsed >= durationMs) return false;
          const progress = elapsed / durationMs;
          const ease = 1 - Math.pow(1 - progress, 2);
          const dist = ease * sparkRadius;
          const len = sparkSize * (1 - progress);
          const x1 = spark.x + dist * Math.cos(spark.angle);
          const y1 = spark.y + dist * Math.sin(spark.angle);
          const x2 = spark.x + (dist + len) * Math.cos(spark.angle);
          const y2 = spark.y + (dist + len) * Math.sin(spark.angle);

          ctx.strokeStyle = sparkColor;
          ctx.globalAlpha = 1 - progress;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          return true;
        });
        ctx.globalAlpha = 1;
      }
      if (sparksRef.current.length > 0) {
        rafId = requestAnimationFrame(render);
      } else {
        rafId = 0;
      }
    };

    const handleClick = (e: PointerEvent) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const rect = wrapper.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const now = performance.now();
      for (let i = 0; i < sparkCount; i += 1) {
        sparksRef.current.push({
          x,
          y,
          angle: (2 * Math.PI * i) / sparkCount,
          startTime: now
        });
      }
      if (!rafId) {
        rafId = requestAnimationFrame(render);
      }
    };

    wrapper.addEventListener('pointerdown', handleClick, { passive: true });
    return () => {
      wrapper.removeEventListener('pointerdown', handleClick);
      ro?.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [sparkColor, sparkCount, sparkRadius, sparkSize, durationMs]);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-50 w-full h-full"
      />
      {children}
    </div>
  );
};
