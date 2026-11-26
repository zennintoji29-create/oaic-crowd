import React, { useRef, useState } from 'react';

interface MagnetProps {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}

export const Magnet: React.FC<MagnetProps> = ({
  children,
  strength = 0.22,
  className = ''
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || typeof window === 'undefined') return;
    if (
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const dx = (e.clientX - (rect.left + rect.width / 2)) * strength;
    const dy = (e.clientY - (rect.top + rect.height / 2)) * strength;
    setOffset({ x: dx, y: dy });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => setOffset({ x: 0, y: 0 })}
      className={`inline-block transition-transform duration-200 ease-out will-change-transform ${className}`}
      style={{ transform: `translate3d(${offset.x.toFixed(1)}px, ${offset.y.toFixed(1)}px, 0)` }}
    >
      {children}
    </div>
  );
};
