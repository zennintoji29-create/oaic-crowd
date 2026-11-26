import React, { useRef, useState } from 'react';

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  spotlightColor?: string;
  className?: string;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  spotlightColor = 'rgba(24, 226, 153, 0.14)',
  className = '',
  onMouseMove,
  onMouseLeave,
  ...rest
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState<number>(0);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    onMouseMove?.(e);
    if (!cardRef.current) return;
    if (
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    ) {
      return;
    }
    const rect = cardRef.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setOpacity(1);
  };

  const handleLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    onMouseLeave?.(e);
    setOpacity(0);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`relative ${className}`}
      {...rest}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <div
          aria-hidden="true"
          className="absolute -inset-px transition-opacity duration-300"
          style={{
            opacity,
            background: `radial-gradient(420px circle at ${pos.x}px ${pos.y}px, ${spotlightColor}, transparent 65%)`
          }}
        />
      </div>
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
};
