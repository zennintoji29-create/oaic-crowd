import React from 'react';

interface GaugeProps {
  score: number;
  size?: number;
  label?: string;
}

export const Gauge: React.FC<GaugeProps> = ({ score, size = 150, label = 'RISK SCORE' }) => {
  const clampedScore = Math.min(100, Math.max(0, score));

  // Determine active accent color
  let color = '#10B981'; // Green
  if (clampedScore >= 75) {
    color = '#EF4444'; // Red
  } else if (clampedScore >= 50) {
    color = '#F59E0B'; // Amber
  }

  // Semi-circle SVG parameters
  const radius = 54;
  const strokeWidth = 10;
  const center = 75;
  const circumference = Math.PI * radius; // Half-circle arc
  const progressOffset = circumference - (clampedScore / 100) * circumference;

  return (
    <div
      className="flex flex-col items-center justify-center select-none"
      role="meter"
      aria-valuenow={clampedScore}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg width={size} height={size * 0.65} viewBox="0 0 150 95" className="overflow-visible">
        {/* Outer subtle ring track */}
        <path
          d="M 18 80 A 57 57 0 0 1 132 80"
          fill="none"
          stroke="rgba(255, 255, 255, 0.04)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />

        {/* Base Track */}
        <path
          d="M 21 80 A 54 54 0 0 1 129 80"
          fill="none"
          stroke="#131B2E"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Calibrated Threshold Markers */}
        {/* Amber Tick at 50% */}
        <line x1="75" y1="20" x2="75" y2="28" stroke="#F59E0B" strokeWidth="1.5" opacity="0.6" />
        {/* Red Tick at 75% */}
        <line x1="113" y1="36" x2="107" y2="42" stroke="#EF4444" strokeWidth="1.5" opacity="0.7" />

        {/* Dynamic Value Arc */}
        <path
          d="M 21 80 A 54 54 0 0 1 129 80"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />

        {/* Center Readout */}
        <text
          x={center}
          y="68"
          textAnchor="middle"
          className="font-mono text-2xl font-bold fill-white tracking-tight"
        >
          {clampedScore.toFixed(0)}
        </text>
        <text
          x={center}
          y="84"
          textAnchor="middle"
          className="text-[9px] font-mono font-semibold tracking-wider fill-slate-400 uppercase"
        >
          {label}
        </text>
      </svg>
    </div>
  );
};
