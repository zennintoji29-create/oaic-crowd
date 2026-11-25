import React from 'react';
import { CrowdState } from '../types';

interface RadarScopeProps {
  zoneName?: string;
  state: CrowdState;
  score: number;
  density: number;
  avgSpeed: number;
  targetCount: number;
}

export const RadarScope: React.FC<RadarScopeProps> = ({
  zoneName = 'Main Temple Gate A',
  state,
  targetCount
}) => {
  // Center of coordinates on SVG canvas (400 x 320)
  const originX = 200;
  const originY = 280;
  const scale = 38; // 1 metre = 38px (6m = 228px)

  // Synthetic anonymous target locations based on real corridor state
  const targets = React.useMemo(() => {
    if (targetCount === 0) return [];
    if (state === 'RED') {
      // Crowd stall: tightly compressed within 2.5m from sensor, speed < 0.1 m/s
      return [
        { id: '1', x: 200 - 8, y: originY - (2.1 * scale), dist: 2.1, speed: 0.05 },
        { id: '2', x: 200 + 10, y: originY - (2.3 * scale), dist: 2.3, speed: 0.04 },
        { id: '3', x: 200 - 4, y: originY - (2.6 * scale), dist: 2.6, speed: 0.08 }
      ];
    } else if (state === 'AMBER') {
      // Congestion: intermediate spacing, speed ~ 0.5-0.7 m/s
      return [
        { id: '1', x: 200 - 18, y: originY - (2.4 * scale), dist: 2.4, speed: 0.60 },
        { id: '2', x: 200 + 16, y: originY - (3.8 * scale), dist: 3.8, speed: 0.55 },
        { id: '3', x: 200 - 10, y: originY - (5.1 * scale), dist: 5.1, speed: 0.65 }
      ];
    } else {
      // Clear laminar flow: spaced apart, speed > 1.2 m/s
      return [
        { id: '1', x: 200 - 24, y: originY - (2.8 * scale), dist: 2.8, speed: 1.35 },
        { id: '2', x: 200 + 26, y: originY - (4.7 * scale), dist: 4.7, speed: 1.25 }
      ];
    }
  }, [state, targetCount, scale, originY]);

  return (
    <div className="flat-panel p-4 flex flex-col justify-between">
      {/* Title & Technical Specs */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle text-xs">
        <div>
          <h3 className="font-semibold text-text-primary text-sm">
            Radar View: {zoneName}
          </h3>
          <p className="text-text-secondary text-[11px]">
            Anonymous micro-Doppler radar (HLK-LD2410) • 120° field of view
          </p>
        </div>
        <div className="text-right font-mono text-[11px] text-text-secondary">
          <span>{targets.length} people detected</span>
        </div>
      </div>

      {/* Flat SVG Radar Diagram */}
      <div className="relative w-full aspect-[4/3] max-h-[300px] my-3 flex items-center justify-center bg-surface-sunken border border-border-subtle rounded overflow-hidden">
        <svg viewBox="0 0 400 300" className="w-full h-full select-none" aria-label="Flat radar polar diagram">
          {/* 120-degree sector outline */}
          <path
            d={`M ${originX} ${originY} L 30 60 A 240 240 0 0 1 370 60 Z`}
            fill="var(--surface-base)"
            stroke="var(--border-subtle)"
            strokeWidth="1"
          />

          {/* Central Azimuth Sightline (0°) */}
          <line
            x1={originX}
            y1={originY}
            x2={originX}
            y2="45"
            stroke="var(--border-subtle)"
            strokeWidth="1"
            strokeDasharray="2 2"
          />

          {/* Corridor Boundaries (-1.8m and +1.8m) */}
          <line
            x1={originX - (1.8 * scale * 0.75)}
            y1={originY}
            x2={originX - (1.8 * scale * 0.75)}
            y2="45"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <line
            x1={originX + (1.8 * scale * 0.75)}
            y1={originY}
            x2={originX + (1.8 * scale * 0.75)}
            y2="45"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Concentric Metric Distance Rings: 2m, 4m, 6m */}
          {[2, 4, 6].map(distMeters => {
            const r = distMeters * scale;
            return (
              <g key={distMeters}>
                <circle
                  cx={originX}
                  cy={originY}
                  r={r}
                  fill="none"
                  stroke="var(--border-subtle)"
                  strokeWidth="1"
                />
                <text
                  x={originX + 6}
                  y={originY - r + 12}
                  fill="var(--text-muted)"
                  fontSize="10"
                  fontFamily="Fira Code, monospace"
                >
                  {distMeters}m
                </text>
              </g>
            );
          })}

          {/* Radar Position Marked as "Sensor" */}
          <circle cx={originX} cy={originY} r="5" fill="var(--accent-default)" />
          <text
            x={originX}
            y={originY + 16}
            textAnchor="middle"
            fill="var(--text-primary)"
            fontSize="10"
            fontWeight="bold"
            fontFamily="Fira Sans, sans-serif"
          >
            Sensor
          </text>

          {/* Anonymous Detected People (Dots + Unboxed Text: Distance and Speed Only) */}
          {targets.map(target => {
            const dotFill =
              state === 'RED'
                ? 'var(--status-danger-chart)'
                : state === 'AMBER'
                ? 'var(--status-building-chart)'
                : 'var(--status-clear-chart)';

            return (
              <g key={target.id}>
                {/* Person Target Dot */}
                <circle
                  cx={target.x}
                  cy={target.y}
                  r="4.5"
                  fill={dotFill}
                  stroke="var(--surface-raised)"
                  strokeWidth="1.5"
                />

                {/* Unboxed plain text: Distance and Speed only */}
                <text
                  x={target.x + 8}
                  y={target.y - 4}
                  fill="var(--text-primary)"
                  fontSize="10"
                  fontFamily="Fira Code, monospace"
                  fontWeight="bold"
                >
                  {target.dist.toFixed(1)} m, {target.speed.toFixed(2)} m/s
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend & Plain Notes */}
      <div className="pt-2 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-text-secondary">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-status-clear-chart inline-block shrink-0" />
          <span>Dots = people detected (anonymous)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-text-muted inline-block shrink-0" />
          <span>Dashed lines = corridor edges</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block shrink-0" />
          <span>Radar position marked as &quot;Sensor&quot;</span>
        </div>
      </div>
    </div>
  );
};
