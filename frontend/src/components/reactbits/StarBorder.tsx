import React from 'react';

interface StarBorderProps {
  children: React.ReactNode;
  color?: string;
  speedSec?: number;
  className?: string;
}

export const StarBorder: React.FC<StarBorderProps> = ({
  children,
  color = '#18e299',
  speedSec = 5,
  className = ''
}) => {
  return (
    <div className={`relative inline-flex rounded-full p-[1px] overflow-hidden ${className}`}>
      <div
        aria-hidden="true"
        className="rb-star-border pointer-events-none absolute inset-[-120%]"
        style={
          {
            '--rb-star-duration': `${speedSec}s`,
            background: `conic-gradient(from 0deg, transparent 0deg, ${color} 40deg, transparent 90deg, transparent 180deg, ${color} 220deg, transparent 270deg)`
          } as React.CSSProperties
        }
      />
      <div className="relative z-10 inline-flex rounded-full">{children}</div>
    </div>
  );
};
