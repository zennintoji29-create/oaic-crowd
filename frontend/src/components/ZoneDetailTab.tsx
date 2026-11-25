import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend
} from 'recharts';
import {
  DoorClosed,
  DoorOpen,
  VolumeX,
  RotateCcw
} from 'lucide-react';
import { ZoneInfo, TelemetryPoint, OperatorCommand } from '../types';
import { fetchZoneHistory, sendOperatorCommand } from '../lib/api';
import { ConfirmModal } from './ConfirmModal';
import { RadarScope } from './RadarScope';
import { StateBadge } from './StateBadge';
import { METRIC_EXPLANATIONS } from '../lib/formatter';

interface ZoneDetailTabProps {
  zones: ZoneInfo[];
  selectedZoneId: string;
  onSelectZoneId: (id: string) => void;
}

export const ZoneDetailTab: React.FC<ZoneDetailTabProps> = ({
  zones,
  selectedZoneId,
  onSelectZoneId
}) => {
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [activeModalCommand, setActiveModalCommand] = useState<OperatorCommand | null>(null);
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState<boolean>(false);

  const currentZone = zones.find(z => z.zoneId === selectedZoneId) || zones[0];

  // Fetch 10-minute historical telemetry
  useEffect(() => {
    if (!currentZone) return;
    let isMounted = true;

    async function loadData() {
      try {
        const data = await fetchZoneHistory(currentZone.zoneId, 10);
        if (isMounted) setHistory(data);
      } catch (err) {
        console.warn('Failed to load history:', err);
      }
    }

    loadData();
    const interval = setInterval(loadData, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentZone?.zoneId]);

  if (!currentZone) {
    return <div className="p-8 text-center text-text-muted">No zones configured.</div>;
  }

  const status = currentZone.currentStatus || 'OFFLINE';

  // Format history for Recharts
  const chartData = history.map(item => {
    const timeDate = new Date(item.serverTimestamp || item.timestamp);
    return {
      time: timeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      score: item.score,
      density: item.density,
      avgSpeed: item.avgSpeed,
      stopGo: item.stopGoIndex
    };
  });

  const handleCommandConfirm = async (reason: string) => {
    if (!activeModalCommand || !currentZone) return;

    try {
      await sendOperatorCommand(currentZone.deviceId, activeModalCommand, reason);
      const friendlyCommand =
        activeModalCommand === 'MANUAL_GATE_CLOSE'
          ? 'Barrier close command'
          : activeModalCommand === 'MANUAL_GATE_OPEN'
          ? 'Barrier open command'
          : activeModalCommand === 'SILENCE_BUZZER'
          ? 'Silence buzzer command'
          : 'Sensor reset command';

      setCommandFeedback(`${friendlyCommand} sent to sensor node ${currentZone.deviceId} (${reason}).`);
      setTimeout(() => setCommandFeedback(null), 5000);
    } catch (err: any) {
      setCommandFeedback(`Failed to send command: ${err.message}`);
    } finally {
      setActiveModalCommand(null);
    }
  };

  const getPlainStatus = () => {
    if (status === 'RED') {
      return {
        word: 'Danger',
        badgeClass: 'bg-rose-950 text-rose-300 border-rose-700',
        explanation:
          'People are packed tightly and movement has slowed or stopped. Entry should be paused until space clears.'
      };
    }
    if (status === 'AMBER') {
      if (currentZone.score >= 60) {
        return {
          word: 'Crowded',
          badgeClass: 'bg-amber-950 text-amber-300 border-amber-700',
          explanation:
            'Crowd levels are building up and walking speed is restricted. Entry is being metered to prevent congestion.'
        };
      }
      return {
        word: 'Busy',
        badgeClass: 'bg-amber-950/70 text-amber-200 border-amber-800',
        explanation:
          'Foot traffic is steady and moderately dense, but people are still moving smoothly through the zone.'
      };
    }
    if (status === 'GREEN') {
      return {
        word: 'Clear',
        badgeClass: 'bg-emerald-950 text-emerald-300 border-emerald-700',
        explanation:
          'Space is open and people are moving freely with no signs of buildup.'
      };
    }
    return {
      word: 'Offline',
      badgeClass: 'bg-slate-900 text-slate-400 border-slate-700',
      explanation: 'Sensor feed is currently unavailable or waiting for connection.'
    };
  };

  const plainStatus = getPlainStatus();

  const formatAge = (ms: number | null | undefined): string => {
    if (ms === null || ms === undefined || isNaN(ms)) return 'Waiting for sensor';
    const sec = Math.floor(ms / 1000);
    if (sec < 2) return 'Just now';
    if (sec < 60) return `${sec} seconds ago`;
    const min = Math.floor(sec / 60);
    return `${min} minutes ago`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header: Zone name, current state with plain sentence, last update */}
      <div className="flat-panel p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-text-muted uppercase">Corridor Zone</span>
              <span className="text-text-muted select-none">•</span>
              <span className="text-xs font-mono text-text-secondary">Node: {currentZone.deviceId}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
                {currentZone.name}
              </h2>
              <span
                className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wide ${plainStatus.badgeClass}`}
              >
                {plainStatus.word}
              </span>
              <StateBadge state={status} size="sm" />
            </div>

            <p className="text-sm text-text-primary mt-2 leading-relaxed font-medium">
              {plainStatus.explanation}
            </p>

            <span className="text-[11px] font-mono text-text-muted block mt-1.5">
              Last sensor update: {formatAge(currentZone.lastSeenMsAgo)}
            </span>
          </div>

          {/* Zone Selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="zoneSelect" className="text-xs font-medium text-text-secondary">
              Switch zone:
            </label>
            <select
              id="zoneSelect"
              value={currentZone.zoneId}
              onChange={e => onSelectZoneId(e.target.value)}
              className="bg-surface-raised border border-border-strong text-text-primary text-xs rounded px-2.5 py-1.5 focus-visible:outline"
              style={{ backgroundColor: 'var(--surface-raised)', color: 'var(--text-primary)' }}
            >
              {zones.map(z => (
                <option key={z.zoneId} value={z.zoneId}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {commandFeedback && (
        <div className="p-3 bg-surface-sunken border border-border-strong text-xs font-mono text-text-primary rounded" role="alert">
          {commandFeedback}
        </div>
      )}

      {/* 2. Top Grid: Left Radar View (Flat Diagram), Right Outlined Actuator Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left, large: Flat Radar View */}
        <div className="lg:col-span-7">
          <RadarScope
            zoneName={currentZone.name}
            state={status}
            score={currentZone.score}
            density={currentZone.density}
            avgSpeed={currentZone.avgSpeed}
            targetCount={currentZone.lastTelemetry?.targetCount || 2}
          />
        </div>

        {/* Right: Barrier and alert controls as four outlined buttons */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flat-panel p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-1">
              Barrier and Alert Controls
            </h3>
            <p className="text-xs text-text-secondary mb-4 leading-relaxed">
              Direct physical overrides for the corridor gate servo and acoustic buzzer. Each action requires confirmation.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => setActiveModalCommand('MANUAL_GATE_CLOSE')}
                className="flex items-center gap-2 p-3 border border-border-strong hover:bg-surface-sunken rounded text-xs font-semibold text-text-primary transition-colors focus-visible:outline text-left"
              >
                <DoorClosed className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
                <div>
                  <div>Close barrier</div>
                  <span className="text-[10px] text-text-muted font-normal block">Set servo to 90°</span>
                </div>
              </button>

              <button
                onClick={() => setActiveModalCommand('MANUAL_GATE_OPEN')}
                className="flex items-center gap-2 p-3 border border-border-strong hover:bg-surface-sunken rounded text-xs font-semibold text-text-primary transition-colors focus-visible:outline text-left"
              >
                <DoorOpen className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
                <div>
                  <div>Open barrier</div>
                  <span className="text-[10px] text-text-muted font-normal block">Release servo to 0°</span>
                </div>
              </button>

              <button
                onClick={() => setActiveModalCommand('SILENCE_BUZZER')}
                className="flex items-center gap-2 p-3 border border-border-strong hover:bg-surface-sunken rounded text-xs font-semibold text-text-primary transition-colors focus-visible:outline text-left"
              >
                <VolumeX className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
                <div>
                  <div>Silence buzzer</div>
                  <span className="text-[10px] text-text-muted font-normal block">Mute GPIO14 buzzer</span>
                </div>
              </button>

              <button
                onClick={() => setActiveModalCommand('RESET_ZONE')}
                className="flex items-center gap-2 p-3 border border-border-strong hover:bg-surface-sunken rounded text-xs font-semibold text-text-primary transition-colors focus-visible:outline text-left"
              >
                <RotateCcw className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
                <div>
                  <div>Reset this sensor</div>
                  <span className="text-[10px] text-text-muted font-normal block">Clear state & counters</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Technical Numbers & Charts */}
      <div className="flat-panel p-4">
        <button
          type="button"
          onClick={() => setShowTechnical((prev) => !prev)}
          aria-expanded={showTechnical}
          className="w-full flex items-center justify-between text-xs font-semibold text-text-primary hover:text-emerald-400 transition-colors"
        >
          <span>{showTechnical ? 'Hide technical details' : 'Show technical details'}</span>
          <span className="font-mono text-[11px] text-text-muted">
            {showTechnical ? '▲ Collapse' : '▼ Expand numbers & charts'}
          </span>
        </button>

        {showTechnical && (
          <div className="mt-4 pt-4 border-t border-border-subtle space-y-6">
            {/* Corridor Geometry Information */}
            <div className="flat-panel-sunken p-4 text-xs text-text-secondary space-y-1 font-mono">
              <div className="flex justify-between">
                <span>Monitored area:</span>
                <span className="font-semibold text-text-primary">{currentZone.areaSqM} m²</span>
              </div>
              <div className="flex justify-between">
                <span>Corridor width:</span>
                <span className="font-semibold text-text-primary">{currentZone.corridorWidthM} m</span>
              </div>
              <div className="flex justify-between">
                <span>People counted inside:</span>
                <span className="font-semibold text-text-primary">
                  {Math.max(0, (currentZone.lastTelemetry?.entryCount || 0) - (currentZone.lastTelemetry?.exitCount || 0))} people
                </span>
              </div>
            </div>

            {/* 3. Below: Three Metric Blocks with One-Sentence Explanations */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flat-panel p-4">
          <span className="text-xs text-text-secondary block font-medium">
            {METRIC_EXPLANATIONS.density.label}
          </span>
          <div className="font-mono text-2xl font-bold text-text-primary mt-1 mb-1">
            {currentZone.density.toFixed(2)}{' '}
            <span className="text-xs text-text-muted font-normal">people/m²</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            {METRIC_EXPLANATIONS.density.explanation}
          </p>
        </div>

        <div className="flat-panel p-4">
          <span className="text-xs text-text-secondary block font-medium">
            {METRIC_EXPLANATIONS.avgSpeed.label}
          </span>
          <div className="font-mono text-2xl font-bold text-text-primary mt-1 mb-1">
            {currentZone.avgSpeed.toFixed(2)}{' '}
            <span className="text-xs text-text-muted font-normal">m/s</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            {METRIC_EXPLANATIONS.avgSpeed.explanation}
          </p>
        </div>

        <div className="flat-panel p-4">
          <span className="text-xs text-text-secondary block font-medium">
            {METRIC_EXPLANATIONS.stopGoIndex.label}
          </span>
          <div className="font-mono text-2xl font-bold text-text-primary mt-1 mb-1">
            {(currentZone.lastTelemetry?.stopGoIndex || 0).toFixed(2)}{' '}
            <span className="text-xs text-text-muted font-normal">σ (m/s)</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            {METRIC_EXPLANATIONS.stopGoIndex.explanation}
          </p>
        </div>
      </div>

      {/* 4. Below: Two Focused Single-Question Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Crowd risk score over time */}
        <div className="flat-panel p-5">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-text-primary">
              How has crowd risk changed over the last 10 minutes?
            </h4>
            <p className="text-xs text-text-secondary mt-0.5">
              Amber (50) and Red (75) safety threshold lines indicate when alerts and gate closure occur.
            </p>
          </div>

          <div className="h-60 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-mono text-text-muted">
                Waiting for telemetry samples...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 80, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                  <YAxis domain={[0, 100]} stroke="var(--text-muted)" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface-raised)',
                      borderColor: 'var(--border-strong)',
                      borderRadius: '4px',
                      color: 'var(--text-primary)',
                      fontSize: '11px'
                    }}
                    formatter={(val: number) => [`${val.toFixed(1)} / 100`, 'Crowd risk score']}
                  />
                  <ReferenceLine y={50} stroke="var(--status-building-chart)" strokeDasharray="3 3" label={{ value: 'Amber (50)', fill: 'var(--status-building-chart)', fontSize: 10, position: 'right' }} />
                  <ReferenceLine y={75} stroke="var(--status-danger-chart)" strokeDasharray="3 3" label={{ value: 'Red (75)', fill: 'var(--status-danger-chart)', fontSize: 10, position: 'right' }} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="Risk score (0-100)"
                    stroke="var(--accent-default)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Density vs movement speed */}
        <div className="flat-panel p-5">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-text-primary">
              When crowd density rises while movement slows, risk rises
            </h4>
            <p className="text-xs text-text-secondary mt-0.5">
              Dual-axis comparison: green line = crowd density (people/m²), blue line = movement speed (m/s).
            </p>
          </div>

          <div className="h-60 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-mono text-text-muted">
                Waiting for telemetry samples...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                  <XAxis dataKey="time" stroke="var(--text-muted)" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                  <YAxis yAxisId="left" stroke="var(--status-clear-chart)" tick={{ fontSize: 10, fill: 'var(--status-clear-chart)' }} />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--accent-default)" tick={{ fontSize: 10, fill: 'var(--accent-default)' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface-raised)',
                      borderColor: 'var(--border-strong)',
                      borderRadius: '4px',
                      color: 'var(--text-primary)',
                      fontSize: '11px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="density"
                    name="Crowd density (people/m²)"
                    stroke="var(--status-clear-chart)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgSpeed"
                    name="Movement speed (m/s)"
                    stroke="var(--accent-default)"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={activeModalCommand !== null}
        command={activeModalCommand}
        zoneName={currentZone.name}
        onConfirm={handleCommandConfirm}
        onClose={() => setActiveModalCommand(null)}
      />
    </div>
  );
};
