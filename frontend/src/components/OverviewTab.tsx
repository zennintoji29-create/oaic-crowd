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
import { ShieldCheck, AlertTriangle, ShieldAlert, Activity, Radio, Lock, RotateCcw, ChevronRight } from 'lucide-react';

interface OverviewTabProps {
  zones: ZoneInfo[];
  gates?: GateState[];
  worstState: CrowdState;
  hardware?: HardwareActuatorState | null;
  onSelectZone: (zoneId: string) => void;
  onGateUpdated?: (updatedGate: GateState) => void;
  onResetAll?: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  zones,
  gates = [],
  worstState,
  hardware,
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
      {/* Consistent Page Header */}
      <div className="flat-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-text-primary tracking-tight">
            Gate Overview
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
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

      {/* 1. Overall System Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Threat Level */}
        <div className={`flat-panel p-4 flex flex-col justify-between border-t-2 ${
          isRed
            ? 'border-t-status-danger-chart'
            : (isAmber ? 'border-t-status-building-chart' : 'border-t-status-clear-chart')
        }`}>
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase font-semibold tracking-wider text-text-muted">Global Threat</span>
            {isRed ? <ShieldAlert className="w-4 h-4 text-status-danger-text" /> : (isAmber ? <AlertTriangle className="w-4 h-4 text-status-building-text" /> : <ShieldCheck className="w-4 h-4 text-status-clear-text" />)}
          </div>
          <div className="mt-3">
            <span className={`text-xl font-bold block ${
              isRed ? 'text-status-danger-text' : (isAmber ? 'text-status-building-text' : 'text-status-clear-text')
            }`}>
              {worstState === 'RED' ? 'Critical (Locked)' : (worstState === 'AMBER' ? 'Elevated (Meter)' : 'Normal Flow')}
            </span>
            <span className="text-xs text-text-muted mt-0.5 block">Autonomous Gate Shield Active</span>
          </div>
        </div>

        {/* System Mode */}
        <div className="flat-panel p-4 flex flex-col justify-between border-t-2 border-t-accent">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase font-semibold tracking-wider text-text-muted">Active Sensor Node</span>
            <Radio className="w-4 h-4 text-accent" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold text-text-primary block">
              {hardware?.systemMode === 'HARDWARE_FAILOVER' ? 'Radar Failover' : 'AI Vision (CUDA)'}
            </span>
            <span className="text-xs text-text-muted mt-0.5 block">
              {hardware?.systemMode === 'HARDWARE_FAILOVER' ? 'HLK-LD2410 24GHz FMCW' : 'RTX 3050 @ 17.6 FPS'}
            </span>
          </div>
        </div>

        {/* Monitored Gates */}
        <div className="flat-panel p-4 flex flex-col justify-between border-t-2 border-t-accent">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase font-semibold tracking-wider text-text-muted">Connected Portals</span>
            <Lock className="w-4 h-4 text-accent" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold text-text-primary tabular-nums block">
              {displayGates.length} Smart Gates
            </span>
            <span className="text-xs text-text-muted mt-0.5 block">Gate A & Gate B Online</span>
          </div>
        </div>

        {/* Total Crowd Count */}
        <div className="flat-panel p-4 flex flex-col justify-between border-t-2 border-t-accent">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase font-semibold tracking-wider text-text-muted">Total Monitored</span>
            <Activity className="w-4 h-4 text-accent" />
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold text-text-primary tabular-nums block">
              {displayGates.reduce((acc, g) => acc + g.count, 0)} Persons
            </span>
            <span className="text-xs text-text-muted mt-0.5 block">Across Active Entry Chutes</span>
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

      {/* 3. Real-Time 10-Minute Risk Score Chart */}
      <section className="p-5 flat-panel">
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
