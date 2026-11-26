import React from 'react';

interface RadarBackdropProps {
  className?: string;
}

export const RadarBackdrop: React.FC<RadarBackdropProps> = ({ className = '' }) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none flex items-center justify-center ${className}`}
    >
      <div className="relative w-[420px] h-[420px] sm:w-[540px] sm:h-[540px] rounded-full">
        {/* Concentric millimeter-wave range rings */}
        <div className="absolute inset-0 rounded-full border border-[#18e299]/10" />
        <div className="absolute inset-[16%] rounded-full border border-[#18e299]/15" />
        <div className="absolute inset-[34%] rounded-full border border-[#18e299]/20" />
        <div className="absolute inset-[52%] rounded-full border border-[#18e299]/25" />

        {/* Crosshair axes */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-[#18e299]/10" />
        <div className="absolute inset-x-0 top-1/2 h-px bg-[#18e299]/10" />

        {/* Sweeping radar sector */}
        <div
          className="rb-radar-sweep absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, rgba(24, 226, 153, 0.22) 0deg, rgba(24, 226, 153, 0.05) 38deg, transparent 78deg)'
          }}
        />
      </div>
    </div>
  );
};
