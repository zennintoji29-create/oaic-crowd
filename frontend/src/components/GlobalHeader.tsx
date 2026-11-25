import React from 'react';
import { Wifi, WifiOff, Play, Pause, Zap } from 'lucide-react';
import { CrowdState, KeepAliveStats } from '../types';
import { StateBadge } from './StateBadge';

interface GlobalHeaderProps {
  worstState: CrowdState;
  worstZoneName: string;
  isWsConnected: boolean;
  isStale: boolean;
  simulatorRunning: boolean;
  onToggleSimulator: () => void;
  keepAliveStats?: KeepAliveStats | null;
  onTriggerPing?: () => void;
}

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  worstState,
  worstZoneName,
  isWsConnected,
  isStale,
  simulatorRunning,
  onToggleSimulator,
  keepAliveStats,
  onTriggerPing
}) => {
  return (
    <header className="border-b border-border-subtle bg-surface-raised sticky top-0 z-30">
      {/* 1. Muted Mandatory Disclaimer Strip */}
      <div className="bg-surface-sunken border-b border-border-subtle px-4 py-1 text-xs text-text-muted flex items-center justify-between">
        <span>
          <strong>Notice:</strong> Prototype for demonstration and learning. Not certified for crowd-safety decisions.
        </span>
        <span className="font-mono text-[11px] hidden sm:inline text-text-secondary">
          HLK-LD2410 mmWave • No cameras
        </span>
      </div>

      {/* 2. Main Header Bar */}
      <div className="px-4 py-2.5 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        {/* Product Identity & Plain Purpose */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-text-primary tracking-tight">
              Crowd Pressure Radar
            </h1>
            <span className="text-[11px] font-mono px-1.5 py-0.2 border border-border-strong rounded text-text-secondary bg-surface-sunken">
              v1.0
            </span>
          </div>
          <p className="text-xs text-text-secondary">
            Early warning for crowd crush. Anonymous radar, no cameras.
          </p>
        </div>

        {/* Global Worst State Pill & Controls */}
        <div className="flex items-center gap-3">
          {/* Worst zone now indicator */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-secondary font-medium hidden md:inline">
              Worst zone now ({worstZoneName}):
            </span>
            <StateBadge state={worstState} size="sm" />
          </div>

          {/* Simulation Toggle */}
          <button
            onClick={onToggleSimulator}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-border-strong rounded bg-surface-sunken hover:bg-surface-raised text-text-primary transition-colors focus-visible:outline"
            title="Toggle simulation feed without physical sensor hardware"
          >
            {simulatorRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
                <span>Pause simulation</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
                <span>Resume simulation</span>
              </>
            )}
          </button>

          {/* Connection Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border ${
              !isWsConnected || isStale
                ? 'bg-status-danger-bg border-status-danger-border text-status-danger-text'
                : 'bg-surface-sunken border-border-subtle text-text-secondary'
            }`}
            role="status"
          >
            {!isWsConnected ? (
              <>
                <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Disconnected</span>
              </>
            ) : isStale ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-status-building-text" aria-hidden="true" />
                <span>Data stale (&gt;5s)</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-status-clear-text" aria-hidden="true" />
                <span className="text-status-clear-text font-medium">LIVE (WS)</span>
              </>
            )}
          </div>

          {/* Render Anti-Sleep Keep-Alive Heartbeat (10m loop) */}
          <button
            onClick={onTriggerPing}
            type="button"
            title={
              keepAliveStats
                ? `Render Anti-Sleep Auto Ping: Active (${keepAliveStats.intervalMinutes}m interval)\nTarget: ${keepAliveStats.targetUrl || 'Auto'}\nTotal Pings: ${keepAliveStats.totalPings} (${keepAliveStats.lastPingStatus})\nLast Ping: ${keepAliveStats.lastPingAt ? new Date(keepAliveStats.lastPingAt).toLocaleTimeString() : 'Just now'}\nClick to force ping now!`
                : 'Render Anti-Sleep Keep-Alive: Active (10m loop prevents cold sleep). Click to test ping.'
            }
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border bg-surface-sunken hover:bg-surface-raised border-border-subtle hover:border-cyan-500/60 text-text-secondary hover:text-cyan-300 transition-colors focus-visible:outline"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden lg:inline text-text-muted">Anti-Sleep:</span>
            <span className="text-cyan-400 font-bold">10m Ping</span>
            {keepAliveStats && keepAliveStats.lastLatencyMs > 0 && (
              <span className="text-[10px] text-text-muted hidden xl:inline">({keepAliveStats.lastLatencyMs}ms)</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

