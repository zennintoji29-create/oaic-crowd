import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  ShieldAlert,
  Sliders,
  AlertTriangle,
  Power,
  RotateCcw,
  ChevronRight,
  CheckCircle2,
  WifiOff
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

  const statusMeta = isRed
    ? {
        label: 'Danger',
        summary: 'Entry paused. Crowd pressure has reached the critical threshold.',
        badgeClass: 'bg-status-danger-bg text-status-danger-text border-status-danger-border',
        barColor: 'var(--status-danger-chart)',
        Icon: ShieldAlert
      }
    : isAmber
    ? {
        label: 'Busy',
        summary: 'Inflow metered. People are moving slowly through this corridor.',
        badgeClass: 'bg-status-building-bg text-status-building-text border-status-building-border',
        barColor: 'var(--status-building-chart)',
        Icon: AlertTriangle
      }
    : isGreen
    ? {
        label: 'Clear',
        summary: 'Normal walking flow. Barrier is open with no buildup.',
        badgeClass: 'bg-status-clear-bg text-status-clear-text border-status-clear-border',
        barColor: 'var(--status-clear-chart)',
        Icon: CheckCircle2
      }
    : {
        label: 'Offline',
        summary: 'Waiting for gate sensor telemetry.',
        badgeClass: 'bg-status-offline-bg text-status-offline-text border-status-offline-border',
        barColor: 'var(--status-offline-chart)',
        Icon: WifiOff
      };

  const StatusIcon = statusMeta.Icon;

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

  const topBorderClass = isRed
    ? 'border-t-2 border-t-status-danger-chart'
    : isAmber
    ? 'border-t-2 border-t-status-building-chart'
    : isGreen
    ? 'border-t-2 border-t-status-clear-chart'
    : 'border-t-2 border-t-border-strong';

  return (
    <div className={`flat-panel ${topBorderClass} p-5 flex flex-col justify-between gap-4`}>
      <div>
        {/* Header: Gate ID, Name, Status Badge, Power Toggle */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface-sunken text-text-secondary border border-border-subtle uppercase">
                {gate.id.toUpperCase()}
              </span>
              <h3 className="font-semibold text-base text-text-primary tracking-tight">
                {gate.name}
              </h3>
            </div>
            <span className="text-xs text-text-muted mt-1 block">
              Zone: {gate.zoneId}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded border text-xs font-semibold inline-flex items-center gap-1.5 ${statusMeta.badgeClass}`}
            >
              <StatusIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{statusMeta.label}</span>
            </span>

            <button
              type="button"
              onClick={handleTogglePower}
              aria-label={gate.power ? `Disable ${gate.name}` : `Enable ${gate.name}`}
              title={gate.power ? 'Gate active (click to disable)' : 'Gate disabled (click to enable)'}
              className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded border transition-colors ${
                gate.power
                  ? 'bg-surface-sunken border-border-strong text-status-clear-text hover:bg-surface-overlay'
                  : 'bg-status-danger-bg border-status-danger-border text-status-danger-text'
              }`}
            >
              <Power className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Large People Count & Supporting Metrics */}
        <div className="grid grid-cols-3 gap-3 my-3 p-3 flat-panel-sunken">
          <div>
            <span className="text-xs text-text-muted block">People count</span>
            <span className="text-2xl sm:text-3xl font-bold text-text-primary tabular-nums mt-0.5 block">
              {gate.count}
            </span>
          </div>

          <div>
            <span className="text-xs text-text-muted block">Density</span>
            <span className="text-lg sm:text-xl font-semibold text-text-primary tabular-nums mt-1 block">
              {gate.density.toFixed(2)} <span className="text-xs font-normal text-text-muted">p/m²</span>
            </span>
          </div>

          <div>
            <span className="text-xs text-text-muted block">Barrier</span>
            <span className="text-lg sm:text-xl font-semibold text-text-primary tabular-nums mt-1 block">
              {gate.servoAngle}°
            </span>
          </div>
        </div>

        {/* Plain-Language Status Line */}
        <p className="text-sm text-text-secondary mb-3">{statusMeta.summary}</p>

        {/* Risk Pressure Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>Pressure index</span>
            <span className="font-semibold text-text-primary tabular-nums">{gate.riskScore.toFixed(0)} / 100</span>
          </div>
          <div className="w-full bg-surface-sunken border border-border-subtle rounded h-2 overflow-hidden">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(6, gate.riskScore))}%`,
                backgroundColor: statusMeta.barColor
              }}
            />
          </div>
        </div>

        {/* Mode Summary */}
        <div className="flex items-center justify-between text-xs text-text-muted pt-2 border-t border-border-subtle">
          <span>Physical state: {gate.servoStatus}</span>
          <span className="font-semibold text-text-secondary">
            {gate.isManualOverride ? 'Manual override' : 'Auto metering'}
          </span>
        </div>
      </div>

      {/* Action Row */}
      <div className="pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2 relative">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowOverrideMenu(!showOverrideMenu)}
            disabled={isSubmitting}
            className="min-h-[44px] inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded border border-border-strong bg-surface-sunken hover:bg-surface-overlay text-text-primary transition-colors"
          >
            <Sliders className="w-4 h-4 text-accent" aria-hidden="true" />
            <span>Manual Override</span>
          </button>

          {showOverrideMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-56 flat-panel p-1.5 z-40 text-xs flex flex-col gap-1">
              <span className="text-[11px] px-2.5 py-1 text-text-muted uppercase font-semibold">
                Select Gate State
              </span>
              <button
                type="button"
                onClick={() => handleOverride('FORCE_OPEN')}
                className="min-h-[44px] w-full text-left px-3 py-2 rounded hover:bg-surface-sunken text-status-clear-text flex items-center justify-between"
              >
                <span>Force Open (90°)</span>
                <Unlock className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => handleOverride('FORCE_METER')}
                className="min-h-[44px] w-full text-left px-3 py-2 rounded hover:bg-surface-sunken text-status-building-text flex items-center justify-between"
              >
                <span>Force Meter (45°)</span>
                <Sliders className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => handleOverride('FORCE_LOCK')}
                className="min-h-[44px] w-full text-left px-3 py-2 rounded hover:bg-surface-sunken text-status-danger-text flex items-center justify-between"
              >
                <span>Emergency Lock (0°)</span>
                <Lock className="w-4 h-4" aria-hidden="true" />
              </button>
              <div className="border-t border-border-subtle my-0.5" />
              <button
                type="button"
                onClick={() => handleOverride('AUTO')}
                className="min-h-[44px] w-full text-left px-3 py-2 rounded hover:bg-surface-sunken text-accent flex items-center justify-between"
              >
                <span>Resume Auto Mode</span>
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSelectGate(gate.zoneId)}
          className="min-h-[44px] inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-accent hover:text-accent-hover transition-colors rounded"
        >
          <span>Zone Details</span>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};
