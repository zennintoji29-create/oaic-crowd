import React, { useState } from 'react';
import {
  Cpu,
  Camera,
  Radio,
  Wifi,
  WifiOff,
  Lock,
  Unlock,
  Volume2,
  VolumeX,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Activity,
  Terminal,
  ExternalLink
} from 'lucide-react';
import { GateState, HardwareManagerSnapshot, OperatingMode } from '../types';
import {
  assignEsp32Gate,
  setHardwareOperatingMode,
  sendHardwareCommand,
  sendHardwareDemo
} from '../lib/api';

interface HardwareControlPanelProps {
  snapshot: HardwareManagerSnapshot | null;
  gates?: GateState[];
  onUpdated?: (next: HardwareManagerSnapshot) => void;
  cameraStreamUrl?: string;
}

export const HardwareControlPanel: React.FC<HardwareControlPanelProps> = ({
  snapshot,
  gates = [],
  onUpdated,
  cameraStreamUrl = ''
}) => {
  const [connectingFallback, setConnectingFallback] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [logTab, setLogTab] = useState<'events' | 'commands'>('events');
  const [streamError, setStreamError] = useState(false);
  const [streamKey, setStreamKey] = useState(0);

  const mode: OperatingMode = snapshot?.operatingMode || 'AI_CAMERA';
  const espConnected = Boolean(snapshot?.esp32Connected);
  const dev = snapshot?.primaryDevice || null;
  const yolo = snapshot?.yoloState;
  const demo = snapshot?.demoState;
  const reported = dev?.reportedOutputs;
  const sensors = dev?.sensors;

  const handleModeSwitch = async (nextMode: OperatingMode) => {
    setModeError(null);
    if (nextMode === 'HARDWARE_FALLBACK') {
      setConnectingFallback(true);
    } else {
      setBusyAction(`mode-${nextMode}`);
    }

    try {
      const res = await setHardwareOperatingMode(nextMode);
      if (res.hardware && onUpdated) onUpdated(res.hardware);
    } catch (err: any) {
      setModeError(err?.message || 'Hardware Fallback connection failed.');
      if (err?.hardware && onUpdated) onUpdated(err.hardware);
    } finally {
      setConnectingFallback(false);
      setBusyAction(null);
    }
  };

  const handleHwCommand = async (
    type: 'GATE_OPEN' | 'GATE_CLOSE' | 'GATE_METER' | 'SERVO_TEST' | 'GATE_RESET' | 'BUZZER_OFF'
  ) => {
    setBusyAction(type);
    setModeError(null);
    try {
      const res = await sendHardwareCommand({ type, deviceId: dev?.deviceId || 'cpr-esp32-master-01' });
      if (res.hardware && onUpdated) onUpdated(res.hardware);
    } catch (err: any) {
      setModeError(err?.message || 'Failed to send hardware command.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDemo = async (action: 'SET_ALERT' | 'RESET', alertLevel?: 'GREEN' | 'AMBER' | 'RED') => {
    setBusyAction(action === 'RESET' ? 'demo-reset' : `demo-${alertLevel}`);
    setModeError(null);
    try {
      const res = await sendHardwareDemo(action, alertLevel);
      if (res.hardware && onUpdated) onUpdated(res.hardware);
    } catch (err: any) {
      setModeError(err?.message || 'Failed to update demonstration simulation.');
    } finally {
      setBusyAction(null);
    }
  };

  const formatLastSeen = (ts?: number) => {
    if (!ts) return 'Never';
    const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    return sec < 2 ? 'Just now' : `${sec}s ago`;
  };

  return (
    <section className="flat-panel p-5 sm:p-6 space-y-6">
      {/* Header + Operating Mode Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight">
              ESP32 Wi-Fi Hardware & Operating Mode
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                espConnected
                  ? 'bg-[#18e299]/10 border-[#18e299]/30 text-[#18e299]'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {espConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{espConnected ? 'ESP32 Online' : 'ESP32 Offline'}</span>
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            YOLO + Camera is primary. ESP32 operates over Wi-Fi as secondary telemetry and physical actuator controller.
          </p>
        </div>

        {/* 3 Operating Modes */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={connectingFallback || busyAction !== null}
            onClick={() => handleModeSwitch('AI_CAMERA')}
            className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${
              mode === 'AI_CAMERA'
                ? 'bg-[#18e299]/15 border-[#18e299]/40 text-[#18e299]'
                : 'bg-white/[0.03] border-white/[0.1] text-neutral-300 hover:bg-white/[0.07]'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>AI Camera Mode</span>
          </button>

          <button
            type="button"
            disabled={connectingFallback || busyAction !== null}
            onClick={() => handleModeSwitch('HARDWARE_FALLBACK')}
            className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${
              mode === 'HARDWARE_FALLBACK'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-white/[0.03] border-white/[0.1] text-neutral-300 hover:bg-white/[0.07]'
            }`}
          >
            {connectingFallback ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Radio className="w-4 h-4" />
            )}
            <span>{connectingFallback ? 'Validating ESP32...' : 'Hardware Fallback'}</span>
          </button>

          <button
            type="button"
            disabled={connectingFallback || busyAction !== null}
            onClick={() => handleModeSwitch('COMBINED_DEMO')}
            className={`min-h-[44px] px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${
              mode === 'COMBINED_DEMO'
                ? 'bg-[#18e299]/15 border-[#18e299]/40 text-[#18e299]'
                : 'bg-white/[0.03] border-white/[0.1] text-neutral-300 hover:bg-white/[0.07]'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Combined Demo</span>
          </button>
        </div>
      </div>

      {modeError && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{modeError}</span>
          </span>
          {mode !== 'AI_CAMERA' && (
            <button
              type="button"
              onClick={() => handleModeSwitch('AI_CAMERA')}
              className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white font-semibold shrink-0"
            >
              Return to Camera Mode
            </button>
          )}
        </div>
      )}

      {/* Side-by-Side: Authoritative YOLO vs Secondary ESP32 Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Authoritative YOLO Vision */}
        <div className="flat-panel-sunken p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#18e299]">
              Authoritative Source: Camera + YOLO11n
            </span>
            <span className="text-[11px] text-neutral-400">
              {yolo?.cameraHealthy ? 'Camera Healthy' : 'Camera Idle/Offline'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <span className="text-neutral-500 block text-[11px]">YOLO Count</span>
              <span className="text-lg font-semibold text-white tabular-nums">{yolo?.count ?? 0}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <span className="text-neutral-500 block text-[11px]">Density</span>
              <span className="text-lg font-semibold text-white tabular-nums">
                {(yolo?.density ?? 0).toFixed(2)}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <span className="text-neutral-500 block text-[11px]">Risk Score</span>
              <span className="text-lg font-semibold text-white tabular-nums">{yolo?.score ?? 0}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <span className="text-neutral-500 block text-[11px]">YOLO Alert</span>
              <span className="text-lg font-semibold text-[#18e299]">{yolo?.alertLevel || 'GREEN'}</span>
            </div>
          </div>

          {/* Configured Localhost Camera Stream Link */}
          {cameraStreamUrl ? (
            <div className="pt-2 border-t border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-neutral-400 font-mono truncate" title={cameraStreamUrl}>
                  {cameraStreamUrl}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  {streamError && (
                    <button
                      type="button"
                      onClick={() => {
                        setStreamError(false);
                        setStreamKey((k) => k + 1);
                      }}
                      className="text-neutral-300 hover:text-white underline"
                    >
                      Retry
                    </button>
                  )}
                  <a
                    href={cameraStreamUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#18e299] hover:underline font-medium"
                  >
                    <span>Open Stream</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                </div>
              </div>
              {!streamError ? (
                <div className="rounded-lg overflow-hidden border border-white/[0.08] bg-black/60">
                  <img
                    key={`${cameraStreamUrl}-${streamKey}`}
                    src={cameraStreamUrl}
                    alt="Configured USB camera and YOLO feed"
                    onLoad={() => setStreamError(false)}
                    onError={() => setStreamError(true)}
                    className="w-full max-h-44 object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-[11px] text-neutral-400">
                  Camera stream preview unavailable inline — start your localhost camera feed or click Open Stream.
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-neutral-500 pt-1 border-t border-white/[0.06]">
              No camera localhost stream URL set yet. Add it in System Setup to view or open the camera link here.
            </p>
          )}
        </div>

        {/* Right: Secondary ESP32 Hardware Telemetry (No fake counts!) */}
        <div className="flat-panel-sunken p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
              Secondary Hardware: ESP32 ({dev?.deviceId || 'Not Registered'})
            </span>
            <span className="text-[11px] text-neutral-400">
              Seen: {formatLastSeen(dev?.lastSeen)} • FW {dev?.firmwareVersion || '—'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <span className="text-neutral-500 block text-[11px]">HLK Presence</span>
              <span className="text-sm font-semibold text-white block mt-1">
                {!espConnected || sensors?.presenceDetected == null
                  ? 'Unavailable'
                  : sensors.presenceDetected
                  ? 'Detected'
                  : 'Clear'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <span className="text-neutral-500 block text-[11px]">ToF Distance</span>
              <span className="text-sm font-semibold text-white tabular-nums block mt-1">
                {!espConnected || sensors?.tofDistanceMm == null
                  ? 'Unavailable'
                  : `${sensors.tofDistanceMm} mm`}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <span className="text-neutral-500 block text-[11px]">Uptime / RSSI</span>
              <span className="text-sm font-semibold text-white tabular-nums block mt-1">
                {espConnected ? `${dev?.uptimeSec ?? 0}s` : 'Offline'}
                {espConnected && dev?.wifiRssi != null ? ` (${dev.wifiRssi}dBm)` : ''}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <span className="text-neutral-500 block text-[11px]">Reported Outputs</span>
              <span className="text-xs font-semibold text-[#18e299] block mt-1">
                {espConnected
                  ? `${reported?.led || 'SAFE'} • ${reported?.servoAngle ?? 90}° • ${reported?.buzzer || 'OFF'}`
                  : 'Unavailable'}
              </span>
            </div>
          </div>

          {/* Assign ESP32 to Gate Dropdown */}
          {gates.length > 0 && (
            <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="esp32-gate-assign" className="text-xs text-neutral-300 font-medium">
                Assign ESP32 Fallback Telemetry to Gate:
              </label>
              <select
                id="esp32-gate-assign"
                value={dev?.zoneId || gates[0]?.zoneId || 'zone-entry-a'}
                disabled={!dev?.deviceId || busyAction === 'assign-gate'}
                onChange={async (e) => {
                  const nextZoneId = e.target.value;
                  setBusyAction('assign-gate');
                  setModeError(null);
                  try {
                    const res = await assignEsp32Gate(nextZoneId, dev?.deviceId);
                    if (res.hardware && onUpdated) onUpdated(res.hardware);
                  } catch (err: any) {
                    setModeError(err?.message || 'Failed to assign gate');
                  } finally {
                    setBusyAction(null);
                  }
                }}
                className="bg-surface-base border border-white/[0.15] text-white text-xs rounded px-2.5 py-1.5 min-w-[200px]"
              >
                {gates.map((g) => (
                  <option key={g.id} value={g.zoneId}>
                    {g.name} ({g.zoneId})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Physical SG90 Gate Controls & Manual Demonstration Simulation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SG90 Servo Gate Controls */}
        <div className="flat-panel-sunken p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white">SG90 Prototype Gate & Buzzer Controls</span>
            <span className="text-[11px] text-neutral-400">
              Ack Seq: #{reported?.lastAckSeq ?? 0}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleHwCommand('GATE_OPEN')}
              className="min-h-[44px] px-3 py-2 rounded-lg border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-xs font-semibold text-[#18e299] inline-flex items-center justify-center gap-1.5"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Open Gate (90°)</span>
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleHwCommand('GATE_CLOSE')}
              className="min-h-[44px] px-3 py-2 rounded-lg border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-xs font-semibold text-rose-300 inline-flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Close Gate (0°)</span>
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleHwCommand('SERVO_TEST')}
              className="min-h-[44px] px-3 py-2 rounded-lg border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-xs font-semibold text-neutral-200 inline-flex items-center justify-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Servo Test</span>
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleHwCommand('GATE_RESET')}
              className="min-h-[44px] px-3 py-2 rounded-lg border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-xs font-semibold text-neutral-200 inline-flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Gate</span>
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleHwCommand('BUZZER_OFF')}
              className="min-h-[44px] px-3 py-2 rounded-lg border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-xs font-semibold text-amber-300 inline-flex items-center justify-center gap-1.5"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Silence Buzzer</span>
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">
            Prototype demonstration actuator only. Fail-open safety returns barrier to 90° on timeout.
          </p>
        </div>

        {/* Manual Demonstration Simulation (Clearly Labelled) */}
        <div className="flat-panel-sunken p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-white">
              Manual Demonstration Mode (Simulation)
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                demo?.active
                  ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                  : 'bg-white/[0.04] border-white/[0.1] text-neutral-400'
              }`}
            >
              {demo?.active ? `SIMULATED: ${demo.alertLevel}` : 'Live YOLO Active'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleDemo('SET_ALERT', 'GREEN')}
              className="min-h-[44px] px-3 py-2 rounded-lg border border-[#18e299]/30 bg-[#18e299]/10 hover:bg-[#18e299]/20 text-xs font-semibold text-[#18e299]"
            >
              Demo GREEN
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleDemo('SET_ALERT', 'AMBER')}
              className="min-h-[44px] px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-semibold text-amber-300"
            >
              Demo AMBER
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleDemo('SET_ALERT', 'RED')}
              className="min-h-[44px] px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold text-rose-300 inline-flex items-center justify-center gap-1"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Demo RED</span>
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleDemo('RESET')}
              className="min-h-[44px] px-3 py-2 rounded-lg border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-white inline-flex items-center justify-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo</span>
            </button>
          </div>
          <p className="text-[11px] text-neutral-500">
            Simulation drives physical LEDs, buzzer, and servo for demonstrations without altering live YOLO counts.
          </p>
        </div>
      </div>

      {/* Hardware Event Logs & Command History */}
      <div className="flat-panel-sunken p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Terminal className="w-4 h-4 text-[#18e299]" />
            <span>Hardware Logs & Command Acknowledgements</span>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setLogTab('events')}
              className={`min-h-[36px] px-3 py-1 rounded text-xs font-medium ${
                logTab === 'events'
                  ? 'bg-[#18e299]/15 text-[#18e299] border border-[#18e299]/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Event Logs ({snapshot?.eventLogs?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setLogTab('commands')}
              className={`min-h-[36px] px-3 py-1 rounded text-xs font-medium ${
                logTab === 'commands'
                  ? 'bg-[#18e299]/15 text-[#18e299] border border-[#18e299]/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Commands ({snapshot?.commandHistory?.length ?? 0})
            </button>
          </div>
        </div>

        <div className="max-h-44 overflow-y-auto space-y-1.5 text-xs">
          {logTab === 'events' ? (
            (snapshot?.eventLogs || []).length === 0 ? (
              <p className="text-neutral-500 py-2">No hardware events logged yet. Connect an ESP32 over Wi-Fi to stream telemetry.</p>
            ) : (
              snapshot?.eventLogs.slice(0, 12).map((ev) => (
                <div key={ev.id} className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-white/[0.02] border border-white/[0.05]">
                  <span className="text-neutral-300">
                    <strong className="text-[#18e299] mr-1.5">[{ev.event}]</strong>
                    {ev.detail}
                  </span>
                  <span className="text-[11px] text-neutral-500 tabular-nums">
                    {new Date(ev.ts).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )
          ) : (snapshot?.commandHistory || []).length === 0 ? (
            <p className="text-neutral-500 py-2">No hardware commands dispatched yet.</p>
          ) : (
            snapshot?.commandHistory.slice(0, 12).map((cmd) => (
              <div key={cmd.seq} className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-white/[0.02] border border-white/[0.05]">
                <span className="text-neutral-300">
                  <strong className="text-white mr-1.5">#{cmd.seq} {cmd.type}</strong>
                  Alert {cmd.alertLevel} • Servo {cmd.servoAngle}° • {cmd.source}
                </span>
                <span className={`text-[11px] font-medium ${cmd.status === 'APPLIED' ? 'text-[#18e299]' : 'text-amber-300'}`}>
                  {cmd.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};
