import React, { useState } from 'react';
import {
  Smartphone,
  Sliders,
  Lock,
  Unlock,
  RotateCcw,
  Plus,
  Minus,
  Zap,
  Activity,
  ShieldAlert,
  Radio,
  Flame,
  CheckCircle,
  EyeOff,
  Eye,
  Sparkles,
  ChevronRight,
  Gauge as GaugeIcon
} from 'lucide-react';
import { GateState, HardwareActuatorState, CrowdState } from '../types';
import { controlGateOverride, controlGatePower, adjustGateDensity, simulateSandbox } from '../lib/api';
import { StateBadge } from './StateBadge';
import { Gauge } from './Gauge';

interface MasterControllerTabProps {
  gates: GateState[];
  hardware?: HardwareActuatorState | null;
  onRefreshGates?: () => void;
}

export const MasterControllerTab: React.FC<MasterControllerTabProps> = ({
  gates,
  hardware,
  onRefreshGates
}) => {
  const [selectedGateId, setSelectedGateId] = useState<string>(gates[0]?.id || 'gate-a');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [simCameraOnline, setSimCameraOnline] = useState(hardware?.cameraOnline ?? true);

  const currentGate = gates.find(g => g.id === selectedGateId) || gates[0];

  const triggerFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleOverride = async (state: 'AUTO' | 'FORCE_OPEN' | 'FORCE_METER' | 'FORCE_LOCK') => {
    if (!currentGate) return;
    setLoading(true);
    try {
      await controlGateOverride(currentGate.id, state);
      triggerFeedback(`Gate ${currentGate.name.split(' ')[0]} ➔ ${state}`);
      if (onRefreshGates) onRefreshGates();
    } catch (err: any) {
      triggerFeedback(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDensityNudge = async (delta: number) => {
    if (!currentGate) return;
    setLoading(true);
    try {
      await adjustGateDensity(currentGate.id, delta);
      triggerFeedback(`Density ${delta > 0 ? `+${delta}` : delta} applied`);
      if (onRefreshGates) onRefreshGates();
    } catch (err: any) {
      triggerFeedback(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateFailover = async () => {
    setLoading(true);
    try {
      const nextCameraState = !simCameraOnline;
      setSimCameraOnline(nextCameraState);
      await simulateSandbox(currentGate.count, nextCameraState, currentGate.id);
      triggerFeedback(nextCameraState ? 'Camera Restored: AI Primary' : 'Camera Dropped: Radar Failover Active!');
      if (onRefreshGates) onRefreshGates();
    } catch (err: any) {
      triggerFeedback(`Failover trigger error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Top Banner with Presentation Indicator */}
      <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-indigo-950 border border-cyan-700/60 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-900/60 border border-cyan-500/80 text-cyan-300">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">
                Mobile Master Controller
              </h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500 text-black">
                TOUCH READY
              </span>
            </div>
            <p className="text-xs text-cyan-200/80">
              Two-panel smartphone touch remote for live demonstrations and stealth judge control.
            </p>
          </div>
        </div>

        {/* Presentation Cheat Sheet Button */}
        <button
          onClick={() => setShowCheatSheet(!showCheatSheet)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-cyan-500/80 bg-cyan-900/40 text-cyan-200 hover:bg-cyan-800/60 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>{showCheatSheet ? 'Hide Demo Script' : 'Judge Demo Script'}</span>
        </button>
      </div>

      {/* Secret Judge Demo Script Card (Collapsible) */}
      {showCheatSheet && (
        <div className="p-4 rounded-lg bg-surface-sunken border border-amber-500/40 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400" />
              Live Presentation Playbook (Stealth Phone Tricks)
            </span>
            <span className="text-[10px] font-mono text-text-muted">For Hackathon & Tech Exhibition</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded bg-surface-base border border-border-subtle">
              <span className="font-bold text-emerald-400 block mb-1">Step 1: Normal Flow</span>
              <p className="text-text-secondary text-[11px]">
                Show screen green. Servo at 90°. People pass freely through Gate A.
              </p>
            </div>
            <div className="p-2.5 rounded bg-surface-base border border-border-subtle">
              <span className="font-bold text-amber-400 block mb-1">Step 2: Tap "+5 Surge"</span>
              <p className="text-text-secondary text-[11px]">
                Count spikes to 6. Traffic light turns yellow. Servo physically meters to 45°.
              </p>
            </div>
            <div className="p-2.5 rounded bg-surface-base border border-border-subtle">
              <span className="font-bold text-red-400 block mb-1">Step 3: Tap "+5 Surge"</span>
              <p className="text-text-secondary text-[11px]">
                Count hits 11+. Gate slams to 0° Lock. Red LED lights up. Buzzer sounds alarm!
              </p>
            </div>
            <div className="p-2.5 rounded bg-surface-base border border-border-subtle">
              <span className="font-bold text-cyan-400 block mb-1">Step 4: Kill Camera</span>
              <p className="text-text-secondary text-[11px]">
                Hit "Drop Camera". Watch system failover instantly to 24GHz radar + ToF!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Feedback Toast */}
      {feedback && (
        <div className="px-4 py-2 rounded bg-cyan-950 border border-cyan-500 text-cyan-300 text-xs font-mono font-bold flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 animate-spin text-cyan-400" />
            <span>{feedback}</span>
          </div>
          <span className="text-[10px] text-text-muted">PHONE COMMAND APPLIED</span>
        </div>
      )}

      {/* Two-Panel Layout (Left: Phone Touch Controls, Right: Real-time Feedback) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* =========================================================================
            LEFT PANEL: Phone Touch Controls (Width 7/12 on desktop)
            ========================================================================= */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flat-panel p-5 space-y-5">
            {/* 1. Gate Selector (Large touch tabs) */}
            <div>
              <label className="block text-[11px] font-mono text-text-muted uppercase tracking-wider mb-2">
                1. Select Target Gate
              </label>
              <div className="grid grid-cols-2 gap-2">
                {gates.map(gate => (
                  <button
                    key={gate.id}
                    onClick={() => setSelectedGateId(gate.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedGateId === gate.id
                        ? 'bg-cyan-950 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                        : 'bg-surface-sunken border-border-subtle hover:border-cyan-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-text-primary">{gate.name}</span>
                      <StateBadge state={gate.status} size="sm" />
                    </div>
                    <div className="text-[11px] font-mono text-text-muted mt-1 flex justify-between">
                      <span>{gate.count} people</span>
                      <span className="text-cyan-400 font-bold">{gate.servoAngle}°</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Rapid Crowd Density Manipulation (The Presentation Weapon) */}
            <div>
              <label className="block text-[11px] font-mono text-text-muted uppercase tracking-wider mb-2">
                2. Rapid Density & Influx Nudge (Live Spikes)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => handleDensityNudge(1)}
                  disabled={loading}
                  className="p-3.5 rounded-lg bg-surface-sunken hover:bg-surface-raised border border-border-strong hover:border-cyan-400 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 shadow-sm"
                >
                  <Plus className="w-5 h-5 text-cyan-400" />
                  <span className="text-xs font-bold text-text-primary">+1 Count</span>
                </button>
                <button
                  onClick={() => handleDensityNudge(-1)}
                  disabled={loading}
                  className="p-3.5 rounded-lg bg-surface-sunken hover:bg-surface-raised border border-border-strong hover:border-cyan-400 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 shadow-sm"
                >
                  <Minus className="w-5 h-5 text-text-muted" />
                  <span className="text-xs font-bold text-text-primary">-1 Count</span>
                </button>
                <button
                  onClick={() => handleDensityNudge(5)}
                  disabled={loading}
                  className="p-3.5 rounded-lg bg-amber-950/60 hover:bg-amber-900 border border-amber-600 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 shadow-sm"
                >
                  <Flame className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-bold text-amber-200">+5 Surge</span>
                </button>
                <button
                  onClick={() => handleDensityNudge(-5)}
                  disabled={loading}
                  className="p-3.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-600 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 shadow-sm"
                >
                  <RotateCcw className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-200">-5 Clear</span>
                </button>
              </div>
            </div>

            {/* 3. Physical Servo Gate Overrides */}
            <div>
              <label className="block text-[11px] font-mono text-text-muted uppercase tracking-wider mb-2">
                3. Physical Barrier Overrides (Servo Arm)
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => handleOverride('FORCE_OPEN')}
                  disabled={loading}
                  className={`p-3.5 rounded-lg border text-left active:scale-98 transition-all flex items-center justify-between ${
                    currentGate?.manualState === 'FORCE_OPEN'
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                      : 'bg-surface-sunken border-border-subtle hover:border-emerald-700 text-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold block">Force Open</span>
                      <span className="text-[10px] text-text-muted">90° Lifted</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400">90°</span>
                </button>

                <button
                  onClick={() => handleOverride('FORCE_METER')}
                  disabled={loading}
                  className={`p-3.5 rounded-lg border text-left active:scale-98 transition-all flex items-center justify-between ${
                    currentGate?.manualState === 'FORCE_METER'
                      ? 'bg-amber-950 border-amber-500 text-amber-300 ring-1 ring-amber-500'
                      : 'bg-surface-sunken border-border-subtle hover:border-amber-700 text-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold block">Force Meter</span>
                      <span className="text-[10px] text-text-muted">45° Stagger</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-400">45°</span>
                </button>

                <button
                  onClick={() => handleOverride('FORCE_LOCK')}
                  disabled={loading}
                  className={`p-3.5 rounded-lg border text-left active:scale-98 transition-all flex items-center justify-between ${
                    currentGate?.manualState === 'FORCE_LOCK'
                      ? 'bg-red-950 border-red-500 text-red-300 ring-1 ring-red-500'
                      : 'bg-surface-sunken border-border-subtle hover:border-red-700 text-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Lock className="w-4 h-4 text-red-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold block">Lockdown</span>
                      <span className="text-[10px] text-text-muted">0° Barricade</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-red-400">0°</span>
                </button>

                <button
                  onClick={() => handleOverride('AUTO')}
                  disabled={loading}
                  className={`p-3.5 rounded-lg border text-left active:scale-98 transition-all flex items-center justify-between ${
                    currentGate?.manualState === 'AUTO'
                      ? 'bg-cyan-950 border-cyan-500 text-cyan-300 ring-1 ring-cyan-500'
                      : 'bg-surface-sunken border-border-subtle hover:border-cyan-700 text-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <RotateCcw className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <span className="text-xs font-bold block">Resume Auto</span>
                      <span className="text-[10px] text-text-muted">YOLO + Radar</span>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-400">AUTO</span>
                </button>
              </div>
            </div>

            {/* 4. Failover & Power Special Triggers */}
            <div className="pt-2 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={handleSimulateFailover}
                disabled={loading}
                className={`flex-1 py-2.5 px-3 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  !simCameraOnline
                    ? 'bg-amber-950 text-amber-300 border-amber-600'
                    : 'bg-surface-sunken hover:bg-surface-raised border-border-strong text-text-primary'
                }`}
              >
                {!simCameraOnline ? (
                  <>
                    <EyeOff className="w-4 h-4 text-amber-400" />
                    <span>Radar Failover Active (Restore Camera)</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-4 h-4 text-cyan-400" />
                    <span>Test Radar Failover (Drop Camera)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT PANEL: Real-time Visual Feedback (Width 5/12 on desktop)
            ========================================================================= */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flat-panel p-5 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div>
                <span className="text-[11px] font-mono uppercase text-text-muted block">Live Gate Feedback</span>
                <h2 className="text-sm font-bold text-text-primary">{currentGate?.name}</h2>
              </div>
              <StateBadge state={currentGate?.status || 'GREEN'} size="sm" />
            </div>

            {/* Dynamic Density Gauge */}
            <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-surface-sunken border border-border-subtle">
              <div className="w-full flex justify-center py-2">
                <Gauge
                  score={currentGate?.riskScore || Math.round((currentGate?.density || 0) * 16)}
                  size={180}
                  label="CROWD PRESSURE"
                />
              </div>

              <div className="flex items-center justify-around w-full mt-2 pt-2 border-t border-border-subtle/60 text-center font-mono">
                <div>
                  <span className="text-[10px] text-text-muted block">PEOPLE COUNT</span>
                  <span className="text-lg font-bold text-text-primary">{currentGate?.count}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted block">RISK SCORE</span>
                  <span className="text-lg font-bold text-cyan-400">{currentGate?.riskScore || 0}</span>
                </div>
                <div>
                  <span className="text-[10px] text-text-muted block">SERVO ANGLE</span>
                  <span className="text-lg font-bold text-amber-400">{currentGate?.servoAngle}°</span>
                </div>
              </div>
            </div>

            {/* Actuator State Indicators */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono text-text-muted uppercase block">
                Physical Actuator Synchrony
              </span>

              {/* Traffic Light Signal Visualizer */}
              <div className="p-3 rounded-lg bg-surface-sunken border border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-primary">Traffic Signal</span>
                  <span className="text-[10px] text-text-muted">ESP32 GPIO 25/26/27</span>
                </div>
                <div className="flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full border border-neutral-700">
                  <div
                    className={`w-3.5 h-3.5 rounded-full transition-all ${
                      currentGate?.status === 'RED'
                        ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                        : 'bg-red-950 opacity-40'
                    }`}
                  />
                  <div
                    className={`w-3.5 h-3.5 rounded-full transition-all ${
                      currentGate?.status === 'AMBER'
                        ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                        : 'bg-amber-950 opacity-40'
                    }`}
                  />
                  <div
                    className={`w-3.5 h-3.5 rounded-full transition-all ${
                      currentGate?.status === 'GREEN'
                        ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]'
                        : 'bg-emerald-950 opacity-40'
                    }`}
                  />
                </div>
              </div>

              {/* System Architecture Mode */}
              <div className="p-3 rounded-lg bg-surface-sunken border border-border-subtle flex items-center justify-between text-xs">
                <div>
                  <span className="text-text-muted block text-[10px] font-mono">ACTIVE ARCHITECTURE</span>
                  <span className="font-bold text-cyan-300">
                    {hardware?.systemMode === 'HARDWARE_FAILOVER' || !simCameraOnline
                      ? 'mmWave Radar + ToF Laser'
                      : 'NVIDIA YOLO11n AI Vision'}
                  </span>
                </div>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                  {hardware?.systemMode === 'HARDWARE_FAILOVER' || !simCameraOnline
                    ? 'FAILOVER'
                    : 'PRIMARY'}
                </span>
              </div>
            </div>

            {/* Quick Status Sentence */}
            <div className="p-3 bg-surface-sunken rounded border border-border-subtle text-xs text-text-secondary leading-relaxed">
              <strong className="text-text-primary">Current Enforcement: </strong>
              {currentGate?.servoAngle === 90 && 'Barrier is fully raised. Pedestrian movement unrestricted.'}
              {currentGate?.servoAngle === 45 && 'Barrier is at 45°. Restricting inflow to prevent bottleneck clustering.'}
              {currentGate?.servoAngle === 0 && 'Emergency barrier locked down. Inflow halted to eliminate crush hazard.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
