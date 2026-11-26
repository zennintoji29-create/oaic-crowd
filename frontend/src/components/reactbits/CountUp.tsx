import React, { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  to: number;
  decimals?: number;
  durationMs?: number;
  className?: string;
  suffix?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
  to,
  decimals = 0,
  durationMs = 550,
  className = '',
  suffix = ''
}) => {
  const [value, setValue] = useState<number>(to);
  const previousRef = useRef<number>(to);

  useEffect(() => {
    const startVal = previousRef.current;
    previousRef.current = to;

    if (
      startVal === to ||
      typeof window === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setValue(to);
      return;
    }

    let frameId = 0;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(startVal + (to - startVal) * eased);
      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setValue(to);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [to, durationMs]);

  const formatted = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();

  return (
    <span className={className}>
      {formatted}
      {suffix}
    </span>
  );
};
