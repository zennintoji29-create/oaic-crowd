import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { ZoneInfo, CrowdState, TelemetryPoint, GateState, HardwareActuatorState, HardwareManagerSnapshot } from '../types';
import { GateCard } from './GateCard';
import { HardwareControlPanel } from './HardwareControlPanel';
import { fetchZoneHistory, resetAllGates } from '../lib/api';
import { formatSystemActions } from '../lib/formatter';
import { ShieldCheck, AlertTriangle, ShieldAlert, Activity, Radio, Lock, RotateCcw, ChevronRight } from 'lucide-react';

interface OverviewTabProps {
  zones: ZoneInfo[];
  gates?: GateState[];
  worstState: CrowdState;
  hardware?: HardwareActuatorState | null;
  hardwareManager?: HardwareManagerSnapshot | null;
  onHardwareManagerUpdated?: (next: HardwareManagerSnapshot) => void;
  onSelectZone: (zoneId: string) => void;
  onGateUpdated?: (updatedGate: GateState) => void;
  onResetAll?: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  zones: _zones,
  gates = [],
  worstState,
  hardware,
  hardwareManager = null,
  onHardwareManagerUpdated,
  onSelectZone,
  onGateUpdated,
  onResetAll
}) => {
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // Default fallback gates if not loaded yet
  const displayGates = gates.length > 0 ? gates : [
    {
      id: 'gate-a',
      name: 'Main Temple Gate A',
      zoneId: 'zone-entry-a',
      status: worstState,
      count: hardware?.currentCount || 2,
      density: 0.15,
      riskScore: worstState === 'RED' ? 88 : (worstState === 'AMBER' ? 58 : 20),
      servoAngle: hardware?.servoAngle || 90,
      servoStatus: hardware?.servoStatus || 'OPEN',
      isManualOverride: false,
      manualState: 'AUTO' as const,
      power: true,
      lastUpdated: Date.now(),
      amberThreshold: 5,
      redThreshold: 10
    },
    {
      id: 'gate-b',
      name: 'North Pavilion Gate B',
      zoneId: 'zone-corridor-b',
      status: 'GREEN' as const,
      count: 1,
      density: 0.10,
      riskScore: 16,
      servoAngle: 90,
      servoStatus: 'OPEN',
      isManualOverride: false,
      manualState: 'AUTO' as const,
      power: true,
      lastUpdated: Date.now(),
      amberThreshold: 5,
      redThreshold: 10
    }
  ];

  const primaryZoneId = 'zone-entry-a';

  // Load 10-minute historical telemetry for primary zone
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const data = await fetchZoneHistory(primaryZoneId, 10);
        if (isMounted) setHistory(data);
      } catch (err) {
        console.warn('Could not load history for overview:', err);
      }
    }
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [primaryZoneId]);

  // Format history for Recharts
  const chartData = history.map(item => {
    const timeDate = new Date(item.serverTimestamp || item.timestamp);
    return {
      time: timeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      score: item.score
    };
  });

  const isRed = worstState === 'RED';
  const isAmber = worstState === 'AMBER';

  const systemActions = formatSystemActions(
    worstState,
    isRed ? 85 : (isAmber ? 55 : 20),
    isRed,
    isRed
  );

  return (
    <div className="space-y-6">
      {/* Consistent Page Header with Mintlify Flowing Wave Accent */}
      <div className="relative overflow-hidden flat-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <svg
          aria-hidden="true"
          viewBox="0 0 900 180"
          fill="none"
          preserveAspectRatio="none"
          className="pointer-events-none select-none absolute inset-0 w-full h-full opacity-45"
        >
          <defs>
            <linearGradient id="dashHeaderWave" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#18e299" stopOpacity="0" />
              <stop offset="50%" stopColor="#18e299" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
          </defs>
          {Array.from({ length: 7 }).map((_, i) => (
            <path
              key={i}
              d={`M -40 ${170 - i * 14} C 260 ${120 + i * 8}, 600 ${40 - i * 10}, 940 ${15 + i * 12}`}
              stroke="url(#dashHeaderWave)"
              strokeWidth="1"
            />
          ))}
        </svg>
        <div className="relative z-10">
          <h2 className="text-lg sm:text-xl font-semibold text-white tracking-[-0.015em]">
            Gate Overview
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
            Live gate status, people count, and pressure trends. Pinned values stay until Reset.
          </p>
        </div>
        <button
          type="button"
          disabled={isResetting}
          onClick={async () => {
            setIsResetting(true);
            try {
              const resetGates = await resetAllGates();
              if (onGateUpdated && Array.isArray(resetGates)) {
                resetGates.forEach((g) => onGateUpdated(g));
              }
              if (onResetAll) onResetAll();
            } catch (e) {
              console.warn('Reset failed:', e);
            } finally {
              setIsResetting(false);
            }
          }}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-status-danger-border bg-status-danger-bg text-status-danger-text hover:opacity-90 text-xs sm:text-sm font-semibold transition-opacity self-start sm:self-auto disabled:opacity-50"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          <span>{isResetting ? 'Resetting...' : 'Reset'}</span>
        </button>
      </div>

      {/* 1. TailAdmin KPI Metric Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* Threat Level */}
        <div className="flat-panel p-5 md:p-6 flex flex-col justify-between">
          <div className="w-12 h-12 rounded-xl bg-surface-overlay flex items-center justify-center">
            {isRed ? (
              <ShieldAlert className="w-5 h-5 text-status-danger-text" aria-hidden="true" />
            ) : isAmber ? (
              <AlertTriangle className="w-5 h-5 text-status-building-text" aria-hidden="true" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-status-clear-text" aria-hidden="true" />
            )}
          </div>
          <div className="mt-5 flex items-end justify-between gap-2">
            <div>
              <span className="text-sm text-text-muted block">Global Threat</span>
              <span className="text-xl font-bold text-text-primary mt-1 block">
                {worstState === 'RED' ? 'Critical' : worstState === 'AMBER' ? 'Elevated' : 'Normal'}
              </span>
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                isRed
                  ? 'bg-status-danger-bg text-status-danger-text'
                  : isAmber
                  ? 'bg-status-building-bg text-status-building-text'
                  : 'bg-status-clear-bg text-status-clear-text'
              }`}
            >
              {worstState === 'RED' ? 'Locked' : worstState === 'AMBER' ? 'Metering' : 'Clear'}
            </span>
          </div>
        </div>

        {/* System Mode */}
        <div className="flat-panel p-5 md:p-6 flex flex-col justify-between">
          <div className="w-11 h-11 rounded-xl bg-[#18e299]/10 border border-[#18e299]/25 flex items-center justify-center">
            <Radio className="w-5 h-5 text-[#18e299]" aria-hidden="true" />
          </div>
          <div className="mt-5 flex items-end justify-between gap-2">
            <div>
              <span className="text-sm text-neutral-400 block">Active Sensor</span>
              <span className="text-xl font-semibold text-white mt-1 block">
                {hardware?.systemMode === 'HARDWARE_FAILOVER' ? 'Radar' : 'AI Vision'}
              </span>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#18e299]/10 border border-[#18e299]/25 text-[#18e299]">
              {hardware?.systemMode === 'HARDWARE_FAILOVER' ? '24 GHz' : 'CUDA'}
            </span>
          </div>
        </div>

        {/* Monitored Gates */}
        <div className="flat-panel p-5 md:p-6 flex flex-col justify-between">
          <div className="w-11 h-11 rounded-xl bg-[#18e299]/10 border border-[#18e299]/25 flex items-center justify-center">
            <Lock className="w-5 h-5 text-[#18e299]" aria-hidden="true" />
          </div>
          <div className="mt-5 flex items-end justify-between gap-2">
            <div>
              <span className="text-sm text-neutral-400 block">Smart Gates</span>
              <span className="text-2xl font-semibold text-white tabular-nums mt-1 block">
                {displayGates.length}
              </span>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#18e299]/10 border border-[#18e299]/25 text-[#18e299]">
              Online
            </span>
          </div>
        </div>

        {/* Total Crowd Count */}
        <div className="flat-panel p-5 md:p-6 flex flex-col justify-between">
          <div className="w-11 h-11 rounded-xl bg-[#18e299]/10 border border-[#18e299]/25 flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#18e299]" aria-hidden="true" />
          </div>
          <div className="mt-5 flex items-end justify-between gap-2">
            <div>
              <span className="text-sm text-neutral-400 block">People Monitored</span>
              <span className="text-2xl font-semibold text-white tabular-nums mt-1 block">
                {displayGates.reduce((acc, g) => acc + g.count, 0)}
              </span>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#18e299]/10 border border-[#18e299]/25 text-[#18e299]">
              Live
            </span>
          </div>
        </div>

      </section>

      {/* 2. Gate Cards Grid: Gate A and Gate B Prominently Displayed */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">
              Portal Gate Modules ({displayGates.length})
            </h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-surface-sunken text-accent border border-border-strong">
              Live Inflow Control
            </span>
          </div>
          <span className="text-xs text-text-muted hidden sm:inline">
            Each gate features independent automated metering & manual override
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {displayGates.map(gate => (
            <GateCard
              key={gate.id}
              gate={gate}
              onSelectGate={onSelectZone}
              onGateUpdated={onGateUpdated}
            />
          ))}
        </div>
      </section>

      {/* 2.5. ESP32 Wi-Fi Hardware, Fallback & Combined Demo Panel */}
      <HardwareControlPanel
        snapshot={hardwareManager}
        onUpdated={onHardwareManagerUpdated}
      />

      {/* 3. Real-Time 10-Minute Risk Score Chart */}
      <section className="p-5 flat-panel">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-4">
          <div>
            <h3 className="text-base font-bold text-text-primary tracking-tight">
              Dynamic Crowd Pressure Trend (Last 10 Minutes)
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Live score (0–100) plotted against Amber (50) and Red (75) safety thresholds.
            </p>
          </div>
          <div className="text-xs text-accent font-medium">
            Source: <span className="font-semibold text-text-primary">Main Temple Gate A</span>
          </div>
        </div>

        <div className="h-64 w-full rounded-md bg-surface-sunken border border-border-subtle p-2">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-text-muted">
              Connecting to live telemetry feed...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 12, right: 68, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="overviewPressureFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#18e299" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#18e299" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#737373"
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#737373"
                  tick={{ fontSize: 11, fill: '#a1a1aa' }}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0d0f11',
                    borderColor: 'rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    color: '#fafafa',
                    fontSize: '12px'
                  }}
                  formatter={(val: number) => [`${val.toFixed(1)} / 100`, 'Risk Pressure Score']}
                  labelStyle={{ color: '#a1a1aa', fontSize: '11px' }}
                />
                <ReferenceLine
                  y={50}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{ value: 'Amber (50)', fill: '#f59e0b', fontSize: 11, position: 'right' }}
                />
                <ReferenceLine
                  y={75}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: 'Red Alert (75)', fill: '#ef4444', fontSize: 11, position: 'right' }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  name="Risk Pressure"
                  stroke="#18e299"
                  fill="url(#overviewPressureFill)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* 4. Automated Actuator Intervention Log */}
      <section className="p-5 flat-panel text-xs">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
          <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
            Active System Actuator Interventions
          </h3>
        </div>
        <p className="text-text-secondary text-xs mb-3">
          Automated physical actuator operations executed by the central hardware state machine logic:
        </p>

        <ul className="space-y-2">
          {systemActions.map((action, idx) => (
            <li key={idx} className="flex items-start gap-2 text-text-primary">
              <ChevronRight className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" aria-hidden="true" />
              <span>{action}</span>
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
};
