import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  ShieldAlert,
  Sliders,
  MoreVertical,
  Check,
  AlertTriangle,
  Power,
  RotateCcw,
  ChevronRight,
  Flame
} from 'lucide-react';
import { GateState } from '../types';
import { controlGateOverride, controlGatePower } from '../lib/api';

interface GateCardProps {
  gate: GateState;
  onSelectGate: (zoneId: string) => void;
  onGateUpdated?: (updatedGate: GateState) => void;
}

export const GateCard: React.FC<GateCardProps> = ({
  gate,
  onSelectGate,
  onGateUpdated
}) => {
  const [showOverrideMenu, setShowOverrideMenu] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const status = gate.status || 'OFFLINE';
  const isRed = status === 'RED';
  const isAmber = status === 'AMBER';
  const isGreen = status === 'GREEN';

  // Status Styling
  const badgeClasses = isRed
    ? 'bg-rose-950/90 text-rose-300 border-rose-700 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
    : isAmber
    ? 'bg-amber-950/90 text-amber-300 border-amber-700 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
    : isGreen
    ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
    : 'bg-slate-900 text-slate-400 border-slate-700';

  const barColor = isRed ? '#f43f5e' : (isAmber ? '#fbbf24' : (isGreen ? '#10b981' : '#64748b'));

  const handleOverride = async (action: string) => {
    setIsSubmitting(true);
    setShowOverrideMenu(false);
    try {
      const updated = await controlGateOverride(gate.id, action);
      if (onGateUpdated && updated) onGateUpdated(updated);
    } catch (err) {
      console.warn('Failed to apply override:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePower = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSubmitting(true);
    try {
      const updated = await controlGatePower(gate.id, !gate.power);
      if (onGateUpdated && updated) onGateUpdated(updated);
    } catch (err) {
      console.warn('Failed to toggle power:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`relative rounded-2xl border-2 transition-all duration-300 p-5 flex flex-col justify-between ${
      isRed
        ? 'border-rose-600/80 bg-rose-950/10 shadow-xl shadow-rose-950/20'
        : isAmber
        ? 'border-amber-500/70 bg-amber-950/10 shadow-lg'
        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
    }`}>
      
      {/* 1. Header: Gate ID & Status Pill */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 uppercase">
                {gate.id.toUpperCase()}
              </span>
              <h3 className="font-bold text-base text-white tracking-tight">
                {gate.name}
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400 mt-0.5 block">
              Zone ID: {gate.zoneId}
            </span>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold tracking-wider flex items-center gap-1.5 ${badgeClasses}`}>
              <span className={`w-2 h-2 rounded-full ${
                isRed ? 'bg-rose-400 animate-ping' : (isAmber ? 'bg-amber-400' : 'bg-emerald-400')
              }`} />
              <span>{status}</span>
            </span>

            {/* Quick Power Toggle */}
            <button
              onClick={handleTogglePower}
              title={gate.power ? 'Gate Active (Click to disable)' : 'Gate Disabled (Click to activate)'}
              className={`p-1.5 rounded-lg border transition ${
                gate.power
                  ? 'bg-slate-800 border-slate-700 text-emerald-400 hover:bg-slate-700'
                  : 'bg-rose-950/80 border-rose-700 text-rose-400'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 2. Key Metrics Grid: Count, Density, Risk */}
        <div className="grid grid-cols-3 gap-3 my-4 py-3 px-3 rounded-xl bg-slate-950/80 border border-slate-800/80 font-mono">
          
          {/* People Count */}
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">People Count</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-white">{gate.count}</span>
              <span className="text-[10px] text-slate-500">PPL</span>
            </div>
          </div>

          {/* Density */}
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Crowd Density</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-bold text-cyan-300">{gate.density.toFixed(2)}</span>
              <span className="text-[10px] text-slate-500">P/m²</span>
            </div>
          </div>

          {/* Risk Level */}
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Risk Level</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className={`text-xl font-black ${
                isRed ? 'text-rose-400' : (isAmber ? 'text-amber-400' : 'text-emerald-400')
              }`}>
                {gate.riskScore.toFixed(0)}
              </span>
              <span className="text-[10px] text-slate-500">/ 100</span>
            </div>
          </div>

        </div>

        {/* Risk Score Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span>Dynamic Risk Pressure</span>
            <span className="font-bold text-slate-300">
              {isRed ? 'CRITICAL STALL' : (isAmber ? 'ELEVATED INFLOW' : 'LAMINAR FLOW')}
            </span>
          </div>
          <div className="w-full bg-slate-950 border border-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="h-full transition-all duration-500 rounded-full"
              style={{
                width: `${Math.min(100, Math.max(8, gate.riskScore))}%`,
                backgroundColor: barColor
              }}
            />
          </div>
        </div>

        {/* 3. Physical Servo Barrier & Actuator Status */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono mb-4">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg border ${
              gate.servoAngle === 0
                ? 'bg-rose-950 text-rose-300 border-rose-700'
                : (gate.servoAngle === 45 ? 'bg-amber-950 text-amber-300 border-amber-700' : 'bg-emerald-950 text-emerald-300 border-emerald-700')
            }`}>
              {gate.servoAngle === 0 ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">PHYSICAL BARRIER</span>
              <span className="font-bold text-white">
                {gate.servoStatus} ({gate.servoAngle}°)
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-slate-400 block">CONTROL MODE</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
              gate.isManualOverride
                ? 'bg-fuchsia-950 text-fuchsia-300 border-fuchsia-700'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}>
              {gate.isManualOverride ? 'MANUAL OVERRIDE' : 'AUTO METERING'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Action Row: Manual Override Dropdown & Deep Inspect */}
      <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 relative">
        {/* Manual Override Action Button */}
        <div className="relative">
          <button
            onClick={() => setShowOverrideMenu(!showOverrideMenu)}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Manual Override</span>
          </button>

          {/* Override Flyout Menu */}
          {showOverrideMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-52 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-40 font-mono text-xs flex flex-col gap-1">
              <span className="text-[10px] px-2 py-1 text-slate-400 uppercase tracking-wider font-bold">
                Select Gate State
              </span>
              <button
                onClick={() => handleOverride('FORCE_OPEN')}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-emerald-950/80 text-emerald-300 flex items-center justify-between transition"
              >
                <span>Force Open (90°)</span>
                <Unlock className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleOverride('FORCE_METER')}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-amber-950/80 text-amber-300 flex items-center justify-between transition"
              >
                <span>Force Meter (45°)</span>
                <Sliders className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleOverride('FORCE_LOCK')}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-rose-950/80 text-rose-300 flex items-center justify-between transition"
              >
                <span>Emergency Lock (0°)</span>
                <Lock className="w-3.5 h-3.5" />
              </button>
              <div className="border-t border-slate-800 my-0.5" />
              <button
                onClick={() => handleOverride('RESUME_AUTO')}
                className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-800 text-cyan-300 flex items-center justify-between transition"
              >
                <span>Resume Autonomous Mode</span>
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Inspect Zone Link */}
        <button
          onClick={() => onSelectGate(gate.zoneId)}
          className="flex items-center gap-1 text-xs font-mono font-medium text-cyan-400 hover:text-cyan-300 transition"
        >
          <span>Zone Details</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
