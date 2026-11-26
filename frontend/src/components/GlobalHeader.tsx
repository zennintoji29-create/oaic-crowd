import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wifi, WifiOff, Play, Pause, LogOut, ShieldCheck, Volume2, VolumeX, Clock } from 'lucide-react';
import { CrowdState } from '../types';
import { StateBadge } from './StateBadge';
import { getTokenExpiryMs } from '../lib/api';

interface GlobalHeaderProps {
  worstState: CrowdState;
  worstZoneName: string;
  isWsConnected: boolean;
  isStale: boolean;
  simulatorRunning: boolean;
  onToggleSimulator: () => void;
  onLogout?: () => void;
  onGoDashboard?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  worstState,
  worstZoneName,
  isWsConnected,
  isStale,
  simulatorRunning,
  onToggleSimulator,
  onLogout,
  onGoDashboard,
  soundEnabled = false,
  onToggleSound
}) => {
  const [minutesLeft, setMinutesLeft] = useState<number | null>(() => {
    const exp = getTokenExpiryMs();
    return exp ? Math.max(0, Math.round((exp - Date.now()) / 60000)) : null;
  });

  useEffect(() => {
    const update = () => {
      const exp = getTokenExpiryMs();
      setMinutesLeft(exp ? Math.max(0, Math.round((exp - Date.now()) / 60000)) : null);
    };
    update();
    const timer = setInterval(update, 30000);
    return () => clearInterval(timer);
  }, []);
  return (
    <header className="border-b border-white/[0.08] bg-[#08090a]/85 backdrop-blur-md sticky top-0 z-30">
      <div className="px-4 py-2 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        {/* Top-Left Hyperlink to Dashboard */}
        <Link
          to="/dashboard"
          onClick={() => onGoDashboard && onGoDashboard()}
          className="flex flex-col rounded-md px-1 py-0.5 hover:opacity-90 transition-opacity"
          title="Go directly to Dashboard Overview"
        >
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-dashed border-[#18e299] bg-[#18e299]/10 text-[#18e299]">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="text-base font-bold text-white tracking-tight">
              CPR
            </span>
          </div>
          <p className="text-xs text-neutral-400 pl-10.5">
            Early warning for crowd crush. Edge vision &amp; ESP32 control.
          </p>
        </Link>

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

          {onToggleSound && (
            <button
              type="button"
              onClick={onToggleSound}
              aria-pressed={soundEnabled}
              title={soundEnabled ? 'Mute critical RED audio alerts' : 'Enable critical RED audio alerts'}
              className={`min-h-[44px] flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-md transition-colors ${
                soundEnabled
                  ? 'border-[#18e299]/40 bg-[#18e299]/10 text-[#18e299]'
                  : 'border-border-strong bg-surface-sunken text-text-secondary hover:text-white'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" aria-hidden="true" /> : <VolumeX className="w-4 h-4" aria-hidden="true" />}
              <span className="hidden xl:inline">{soundEnabled ? 'Alert Sound On' : 'Muted'}</span>
            </button>
          )}

          {minutesLeft !== null && (
            <span
              className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-2 min-h-[44px] rounded-md text-xs border tabular-nums ${
                minutesLeft <= 15
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                  : 'border-border-subtle bg-surface-sunken text-neutral-400'
              }`}
              title="Remaining JWT session window"
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{minutesLeft}m</span>
            </span>
          )}

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
