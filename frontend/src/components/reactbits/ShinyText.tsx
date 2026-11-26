import React from 'react';

interface ShinyTextProps {
  text: string;
  className?: string;
  speedSec?: number;
  disabled?: boolean;
}

export const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  className = '',
  speedSec = 4,
  disabled = false
}) => {
  return (
    <span
      className={`rb-shiny-text inline-block ${disabled ? '' : 'rb-shiny-animate'} ${className}`}
      style={
        disabled
          ? undefined
          : ({ '--rb-shine-duration': `${speedSec}s` } as React.CSSProperties)
      }
    >
      {text}
    </span>
  );
};
