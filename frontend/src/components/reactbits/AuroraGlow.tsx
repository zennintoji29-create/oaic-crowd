import React from 'react';

interface AuroraGlowProps {
  className?: string;
}

export const AuroraGlow: React.FC<AuroraGlowProps> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div className="rb-aurora-lobe-1 absolute -top-36 left-[12%] w-[540px] h-[340px] rounded-full bg-[#18e299]/[0.11] blur-[115px]" />
      <div className="rb-aurora-lobe-2 absolute top-10 right-[8%] w-[460px] h-[300px] rounded-full bg-[#0d9373]/[0.14] blur-[120px]" />
    </div>
  );
};
