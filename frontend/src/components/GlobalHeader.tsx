import React from 'react';
import { Wifi, WifiOff, Play, Pause, LogOut, ShieldCheck } from 'lucide-react';
import { CrowdState } from '../types';
import { StateBadge } from './StateBadge';

interface GlobalHeaderProps {
  worstState: CrowdState;
  worstZoneName: string;
  isWsConnected: boolean;
  isStale: boolean;
  simulatorRunning: boolean;
  onToggleSimulator: () => void;
  onLogout?: () => void;
}

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  worstState,
  worstZoneName,
  isWsConnected,
  isStale,
  simulatorRunning,
  onToggleSimulator,
  onLogout
}) => {
  return (
    <header className="border-b border-border-subtle bg-surface-raised/95 backdrop-blur-sm sticky top-0 z-30">
      <div className="px-4 py-2.5 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        {/* Product Identity */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <h1 className="text-base font-bold text-text-primary tracking-tight">
              Crowd Pressure Radar
            </h1>
            <span className="text-[11px] font-mono px-1.5 py-0.2 border border-border-strong rounded text-text-secondary bg-surface-sunken">
              HLK-LD2410
            </span>
          </div>
          <p className="text-xs text-text-secondary pl-8">
            Early warning for crowd crush. Anonymous radar & edge vision.
          </p>
        </div>

        {/* Global Status & Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-secondary font-medium hidden md:inline">
              Worst zone ({worstZoneName}):
            </span>
            <StateBadge state={worstState} size="sm" />
          </div>

          <button
            type="button"
            onClick={onToggleSimulator}
            className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border-strong rounded-md bg-surface-sunken hover:bg-surface-base text-text-primary transition-colors"
            title="Toggle simulation feed"
          >
            {simulatorRunning ? (
              <>
                <Pause className="w-4 h-4 text-text-secondary" aria-hidden="true" />
                <span>Pause simulation</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-text-secondary" aria-hidden="true" />
                <span>Resume simulation</span>
              </>
            )}
          </button>

          <div
            className={`min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-md text-xs border ${
              !isWsConnected || isStale
                ? 'bg-status-danger-bg border-status-danger-border text-status-danger-text'
                : 'bg-surface-sunken border-border-subtle text-text-secondary'
            }`}
            role="status"
          >
            {!isWsConnected ? (
              <>
                <WifiOff className="w-4 h-4" aria-hidden="true" />
                <span>Disconnected</span>
              </>
            ) : isStale ? (
              <>
                <WifiOff className="w-4 h-4 text-status-building-text" aria-hidden="true" />
                <span>Stale (&gt;5s)</span>
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 text-status-clear-text" aria-hidden="true" />
                <span className="text-status-clear-text font-medium">LIVE</span>
              </>
            )}
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-status-danger-border rounded-md bg-status-danger-bg hover:opacity-90 text-status-danger-text transition-opacity"
              title="Sign out and lock dashboard"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
