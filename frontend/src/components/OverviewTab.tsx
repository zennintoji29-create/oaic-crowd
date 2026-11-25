import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { ZoneInfo, CrowdState, TelemetryPoint, GateState, HardwareActuatorState } from '../types';
import { GateCard } from './GateCard';
import { fetchZoneHistory, resetAllGates } from '../lib/api';
import { formatSystemActions } from '../lib/formatter';
import { ShieldCheck, AlertTriangle, ShieldAlert, Activity, Radio, Lock, RotateCcw } from 'lucide-react';

interface OverviewTabProps {
  zones: ZoneInfo[];
  gates?: GateState[];
  worstState: CrowdState;
  hardware?: HardwareActuatorState | null;
  onSelectZone: (zoneId: string) => void;
  onGateUpdated?: (updatedGate: GateState) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  zones,
  gates = [],
  worstState,
  hardware,
  onSelectZone,
  onGateUpdated
}) => {
  const [history, setHistory] = useState<TelemetryPoint[]>([]);

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
      {/* Reset to Live Data Bar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-text-primary">Live Gate Overview</h2>
          <p className="text-xs text-text-secondary">
            Manual values stay pinned until you press Reset to return to live telemetry.
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              const resetGates = await resetAllGates();
              if (onGateUpdated && Array.isArray(resetGates)) {
                resetGates.forEach((g) => onGateUpdated(g));
              }
            } catch (e) {
              console.warn('Reset failed:', e);
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-strong bg-surface-raised hover:bg-surface-sunken text-xs font-semibold text-text-primary transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
          <span>Reset</span>
        </button>
      </div>

      {/* 1. Overall System Summary Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 font-mono">
        
        {/* Threat Level */}
        <div className={`p-4 rounded-2xl border flex flex-col justify-between ${
          isRed
            ? 'bg-rose-950/40 border-rose-600/80 text-rose-300'
            : (isAmber ? 'bg-amber-950/40 border-amber-600/80 text-amber-300' : 'bg-slate-900/60 border-slate-800 text-slate-300')
        }`}>
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase text-slate-400">Global Threat</span>
            {isRed ? <ShieldAlert className="w-4 h-4 text-rose-400" /> : (isAmber ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />)}
          </div>
          <div className="mt-2">
            <span className="text-xl md:text-2xl font-black block">
              {worstState === 'RED' ? 'CRITICAL (LOCKED)' : (worstState === 'AMBER' ? 'ELEVATED (METER)' : 'NORMAL FLOW')}
            </span>
            <span className="text-[10px] text-slate-500">Autonomous Gate Shield Active</span>
          </div>
        </div>

        {/* System Mode */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-300 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase text-slate-400">Active Sensor Node</span>
            <Radio className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl md:text-2xl font-bold text-cyan-300 block">
              {hardware?.systemMode === 'HARDWARE_FAILOVER' ? 'RADAR FAILOVER' : 'AI VISION (CUDA)'}
            </span>
            <span className="text-[10px] text-slate-500">
              {hardware?.systemMode === 'HARDWARE_FAILOVER' ? 'HLK-LD2410 24GHz FMCW' : 'RTX 3050 @ 17.6 FPS'}
            </span>
          </div>
        </div>

        {/* Monitored Gates */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-300 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase text-slate-400">Connected Portals</span>
            <Lock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl md:text-2xl font-black text-white block">
              {displayGates.length} Smart Gates
            </span>
            <span className="text-[10px] text-slate-500">Gate A & Gate B Online</span>
          </div>
        </div>

        {/* Total Crowd Count */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-300 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase text-slate-400">Total Monitored</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2">
            <span className="text-xl md:text-2xl font-black text-white block">
              {displayGates.reduce((acc, g) => acc + g.count, 0)} Persons
            </span>
            <span className="text-[10px] text-slate-500">Across Active Entry Chutes</span>
          </div>
        </div>

      </section>

      {/* 2. Gate Cards Grid: Gate A and Gate B Prominently Displayed */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-300">
              Portal Gate Modules ({displayGates.length})
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
              Live Inflow Control
            </span>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
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

      {/* 3. Real-Time 10-Minute Risk Score Chart */}
      <section className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 mb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight font-mono">
              Dynamic Crowd Pressure Trend (Last 10 Minutes)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live score (0–100) plotted against Amber (50) and Red (75) safety thresholds.
            </p>
          </div>
          <div className="text-xs font-mono text-cyan-400">
            Source: <span className="font-semibold text-white">Main Temple Gate A</span>
          </div>
        </div>

        <div className="h-64 w-full">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs font-mono text-slate-500">
              Connecting to live telemetry feed...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 120, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '12px'
                  }}
                  formatter={(val: number) => [`${val.toFixed(1)} / 100`, 'Risk Pressure Score']}
                  labelStyle={{ color: '#94a3b8', fontSize: '11px' }}
                />
                <ReferenceLine
                  y={50}
                  stroke="#fbbf24"
                  strokeDasharray="4 4"
                  label={{ value: 'Amber (50)', fill: '#fbbf24', fontSize: 11, position: 'right' }}
                />
                <ReferenceLine
                  y={75}
                  stroke="#f43f5e"
                  strokeDasharray="4 4"
                  label={{ value: 'Red Alert (75)', fill: '#f43f5e', fontSize: 11, position: 'right' }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Risk Pressure"
                  stroke="#22d3ee"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* 4. Automated Actuator Intervention Log */}
      <section className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 text-xs font-mono">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Active System Actuator Interventions
          </h3>
        </div>
        <p className="text-slate-400 text-[11px] mb-3">
          Automated physical actuator operations executed by the central hardware state machine logic:
        </p>

        <ul className="space-y-2">
          {systemActions.map((action, idx) => (
            <li key={idx} className="flex items-start gap-2.5 text-slate-200">
              <span className="text-cyan-400 select-none">▶</span>
              <span>{action}</span>
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
};
