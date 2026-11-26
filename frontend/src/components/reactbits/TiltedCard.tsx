import React, { useRef, useState } from 'react';

interface TiltedCardProps {
  children: React.ReactNode;
  className?: string;
  maxTiltDeg?: number;
}

export const TiltedCard: React.FC<TiltedCardProps> = ({
  children,
  className = '',
  maxTiltDeg = 4.5
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<string>('perspective(1100px) rotateX(0deg) rotateY(0deg)');

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || typeof window === 'undefined') return;
    if (
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const rect = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    const rx = (-py * maxTiltDeg * 2).toFixed(2);
    const ry = (px * maxTiltDeg * 2).toFixed(2);
    setTransform(`perspective(1100px) rotateX(${rx}deg) rotateY(${ry}deg)`);
  };

  const handleLeave = () => {
    setTransform('perspective(1100px) rotateX(0deg) rotateY(0deg)');
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`transition-transform duration-200 ease-out will-change-transform ${className}`}
      style={{ transform }}
    >
      {children}
    </div>
  );
};
