import React, { useMemo, useState } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export type VenueProfile = 'corridor' | 'temple' | 'hall' | 'transit';

interface SpaceAiAdvisorProps {
  initialAreaSqM?: number;
  initialGateCount?: number;
  onApplyRecommendation?: (rec: {
    areaSqM: number;
    corridorWidthM: number;
    amberThreshold: number;
    redThreshold: number;
    recommendedGateCount: number;
  }) => void;
  applyButtonLabel?: string;
}

const VENUE_PROFILES: Record<
  VenueProfile,
  { label: string; amberDensity: number; redDensity: number; minCorridorM: number; tip: string }
> = {
  temple: {
    label: 'Temple Sanctum / Festival Gate',
    amberDensity: 1.4,
    redDensity: 2.4,
    minCorridorM: 3.5,
    tip: 'Use serpentine barricades and pair optical YOLO with 24 GHz radar to guard against incense/smoke occlusion.'
  },
  corridor: {
    label: 'Narrow Queue / Funnel Corridor',
    amberDensity: 1.5,
    redDensity: 2.6,
    minCorridorM: 3.0,
    tip: 'Keep metering active at 45 deg early so standing compression never reaches the barricade line.'
  },
  hall: {
    label: 'Open Hall / Auditorium Gathering',
    amberDensity: 1.8,
    redDensity: 3.2,
    minCorridorM: 4.5,
    tip: 'Reserve at least 20% perimeter clearance near exits and stagger release waves between gates.'
  },
  transit: {
    label: 'Railway Platform / Transit Concourse',
    amberDensity: 1.6,
    redDensity: 2.8,
    minCorridorM: 4.0,
    tip: 'Trigger pre-emptive 45 deg metering 90s prior to arrival surges to avoid platform-edge bottlenecks.'
  }
};

export const SpaceAiAdvisor: React.FC<SpaceAiAdvisorProps> = ({
  initialAreaSqM = 48,
  initialGateCount = 2,
  onApplyRecommendation,
  applyButtonLabel = 'Apply AI Thresholds'
}) => {
  const [spaceValue, setSpaceValue] = useState<string>(String(initialAreaSqM));
  const [unit, setUnit] = useState<'sqm' | 'sqft'>('sqm');
  const [expectedCrowd, setExpectedCrowd] = useState<string>('90');
  const [gateCountInput, setGateCountInput] = useState<number>(Math.min(4, Math.max(1, initialGateCount)));
  const [venueType, setVenueType] = useState<VenueProfile>('temple');
  const [appliedNote, setAppliedNote] = useState<string | null>(null);

  const recommendation = useMemo(() => {
    const rawSpace = Math.max(4, parseFloat(spaceValue) || 24);
    const totalSqM = unit === 'sqft' ? rawSpace * 0.092903 : rawSpace;
    const totalCrowd = Math.max(1, parseInt(expectedCrowd, 10) || 30);
    const profile = VENUE_PROFILES[venueType];

    // Safe instantaneous capacity based on Fruin crowd density thresholds
    const safeCapacityAtRed = Math.max(4, Math.floor(totalSqM * profile.redDensity));
    const recommendedGateCount = Math.min(4, Math.max(gateCountInput, Math.ceil(totalCrowd / Math.max(12, safeCapacityAtRed / 2))));
    const activeGates = Math.max(1, Math.min(4, gateCountInput));
    const areaPerGate = Math.max(4, totalSqM / activeGates);

    const amberThreshold = Math.max(3, Math.min(140, Math.round(areaPerGate * profile.amberDensity)));
    const redThreshold = Math.max(amberThreshold + 2, Math.min(190, Math.round(areaPerGate * profile.redDensity)));
    const greenMax = Math.max(1, amberThreshold - 1);

    const projectedDensity = totalCrowd / totalSqM;
    const riskVerdict =
      projectedDensity >= profile.redDensity
        ? 'CRITICAL_OVERFLOW'
        : projectedDensity >= profile.amberDensity
        ? 'METERING_REQUIRED'
        : 'COMFORTABLE_FLOW';

    const recommendedWidth = Number(
      Math.max(profile.minCorridorM, Math.min(12, Math.sqrt(areaPerGate) * 0.85)).toFixed(1)
    );

    const waveDurationMin = Math.max(1, Math.ceil(totalCrowd / (recommendedGateCount * 28)));

    return {
      totalSqM: Number(totalSqM.toFixed(1)),
      areaPerGate: Number(areaPerGate.toFixed(1)),
      greenMax,
      amberThreshold,
      redThreshold,
      projectedDensity: Number(projectedDensity.toFixed(2)),
      safeCapacityAtRed,
      recommendedGateCount,
      recommendedWidth,
      waveDurationMin,
      riskVerdict,
      profileTip: profile.tip
    };
  }, [spaceValue, unit, expectedCrowd, gateCountInput, venueType]);

  return (
    <div className="flat-panel p-5 space-y-4 border-[#18e299]/25">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#18e299]/15 border border-[#18e299]/30 text-[#18e299]">
              <Sparkles className="w-4 h-4" aria-hidden="true" />
            </span>
            <h2 className="text-base font-semibold text-white">
              AI Space &amp; Crowd Capacity Advisor
            </h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Enter your total hall or corridor space and expected crowd. CPR calculates safe Green / Amber / Red limits and operational guidance.
          </p>
        </div>
        <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-[#18e299]/10 border border-[#18e299]/30 text-[#18e299]">
          Safety Planner
        </span>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="ai-space-size" className="block text-xs font-medium text-neutral-300 mb-1">
            Total Space Area
          </label>
          <div className="flex gap-1.5">
            <input
              id="ai-space-size"
              type="number"
              min="4"
              step="1"
              value={spaceValue}
              onChange={(e) => setSpaceValue(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-surface-base border border-border-strong rounded font-mono text-white"
            />
            <select
              aria-label="Area unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as 'sqm' | 'sqft')}
              className="px-2 py-1.5 text-xs bg-surface-raised border border-border-strong rounded text-white"
            >
              <option value="sqm">m²</option>
              <option value="sqft">sq ft</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="ai-expected-crowd" className="block text-xs font-medium text-neutral-300 mb-1">
            Expected Crowd (People)
          </label>
          <input
            id="ai-expected-crowd"
            type="number"
            min="1"
            step="1"
            value={expectedCrowd}
            onChange={(e) => setExpectedCrowd(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-surface-base border border-border-strong rounded font-mono text-white"
          />
        </div>

        <div>
          <label htmlFor="ai-gate-count" className="block text-xs font-medium text-neutral-300 mb-1">
            Active Gates (1–4)
          </label>
          <select
            id="ai-gate-count"
            value={gateCountInput}
            onChange={(e) => setGateCountInput(parseInt(e.target.value, 10))}
            className="w-full px-3 py-1.5 text-xs bg-surface-raised border border-border-strong rounded text-white"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'Gate' : 'Gates'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ai-venue-type" className="block text-xs font-medium text-neutral-300 mb-1">
            Venue Environment
          </label>
          <select
            id="ai-venue-type"
            value={venueType}
            onChange={(e) => setVenueType(e.target.value as VenueProfile)}
            className="w-full px-3 py-1.5 text-xs bg-surface-raised border border-border-strong rounded text-white"
          >
            {Object.entries(VENUE_PROFILES).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Output Recommendation */}
      <div className="rounded-xl bg-[#08090a]/90 border border-white/[0.08] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            {recommendation.riskVerdict === 'CRITICAL_OVERFLOW' ? (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-400" aria-hidden="true" />
                <span className="text-rose-300">
                  Over-Capacity Alert ({recommendation.projectedDensity} p/m² exceeds safe limit — split into staggered waves)
                </span>
              </>
            ) : recommendation.riskVerdict === 'METERING_REQUIRED' ? (
              <>
                <AlertTriangle className="w-4 h-4 text-amber-400" aria-hidden="true" />
                <span className="text-amber-300">
                  Active Gate Metering Recommended ({recommendation.projectedDensity} p/m² peak load)
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-[#18e299]" aria-hidden="true" />
                <span className="text-[#18e299]">
                  Comfortable Capacity ({recommendation.projectedDensity} p/m² • Safe headroom available)
                </span>
              </>
            )}
          </div>
          <span className="text-[11px] font-mono text-neutral-400">
            {recommendation.totalSqM} m² total ({recommendation.areaPerGate} m²/gate)
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
            <span className="text-[11px] text-emerald-300 block">Green (Open 90°)</span>
            <span className="text-base font-bold text-white tabular-nums">
              0 – {recommendation.greenMax} ppl/gate
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
            <span className="text-[11px] text-amber-300 block">Amber (Meter 45°)</span>
            <span className="text-base font-bold text-white tabular-nums">
              &ge; {recommendation.amberThreshold} ppl/gate
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25">
            <span className="text-[11px] text-rose-300 block">Red (Lock 0°)</span>
            <span className="text-base font-bold text-white tabular-nums">
              &ge; {recommendation.redThreshold} ppl/gate
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08]">
            <span className="text-[11px] text-neutral-400 block">Safe Total Limit</span>
            <span className="text-base font-bold text-white tabular-nums">
              {recommendation.safeCapacityAtRed} ppl max
            </span>
          </div>
        </div>

        <ul className="space-y-1.5 text-xs text-neutral-300">
          <li className="flex items-start gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#18e299] shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Deploy <strong className="text-white">{recommendation.recommendedGateCount} active gates</strong> with at least{' '}
              <strong className="text-white">{recommendation.recommendedWidth} m</strong> corridor barricade width; allow{' '}
              <strong className="text-white">~{recommendation.waveDurationMin} min</strong> staggered release window to process all attendees smoothly.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#18e299] shrink-0 mt-0.5" aria-hidden="true" />
            <span>{recommendation.profileTip}</span>
          </li>
        </ul>

        {onApplyRecommendation && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
            <span className="text-xs font-mono text-[#18e299]">{appliedNote}</span>
            <button
              type="button"
              onClick={() => {
                onApplyRecommendation({
                  areaSqM: recommendation.areaPerGate,
                  corridorWidthM: recommendation.recommendedWidth,
                  amberThreshold: recommendation.amberThreshold,
                  redThreshold: recommendation.redThreshold,
                  recommendedGateCount: recommendation.recommendedGateCount
                });
                setAppliedNote(
                  `Applied Amber >= ${recommendation.amberThreshold}, Red >= ${recommendation.redThreshold} (${recommendation.areaPerGate} m²/gate).`
                );
                setTimeout(() => setAppliedNote(null), 4000);
              }}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#18e299] hover:bg-[#10b981] text-[#08090a] text-xs font-semibold transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{applyButtonLabel}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
