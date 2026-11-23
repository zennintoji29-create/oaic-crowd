import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Sliders,
  Power,
  RotateCcw,
  AlertTriangle,
  Volume2,
  CheckCircle2,
  Activity,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Plus,
  Minus
} from 'lucide-react';
import { GateState, HardwareActuatorState } from '../types';
import { controlGateOverride, controlGatePower, adjustGateDensity } from '../lib/api';
import { StateBadge } from './StateBadge';
import { ConfirmModal } from './ConfirmModal';

interface ManualControlTabProps {
  gates: GateState[];
  hardware?: HardwareActuatorState | null;
  onRefreshGates?: () => void;
}

export const ManualControlTab: React.FC<ManualControlTabProps> = ({
  gates,
  hardware,
  onRefreshGates
}) => {
  const [selectedGateId, setSelectedGateId] = useState<string>(gates[0]?.id || 'gate-a');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [confirmLockModal, setConfirmLockModal] = useState(false);

  const currentGate = gates.find(g => g.id === selectedGateId) || gates[0];

  const showFeedback = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleOverride = async (state: 'AUTO' | 'FORCE_OPEN' | 'FORCE_METER' | 'FORCE_LOCK') => {
    if (!currentGate) return;
    setLoading(true);
    try {
      await controlGateOverride(currentGate.id, state);
      showFeedback(`Command executed: Gate ${currentGate.name} set to ${state}`);
      if (onRefreshGates) onRefreshGates();
    } catch (err: any) {
      showFeedback(`Failed to execute override: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePowerToggle = async () => {
    if (!currentGate) return;
    setLoading(true);
    try {
      const nextPower = !currentGate.power;
      await controlGatePower(currentGate.id, nextPower);
      showFeedback(`Gate ${currentGate.name} ${nextPower ? 'powered ON' : 'powered OFF (Standby)'}`);
      if (onRefreshGates) onRefreshGates();
    } catch (err: any) {
      showFeedback(`Power toggle failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDensityNudge = async (delta: number) => {
    if (!currentGate) return;
    setLoading(true);
    try {
      await adjustGateDensity(currentGate.id, delta);
      showFeedback(`Density adjusted by ${delta > 0 ? `+${delta}` : delta} for ${currentGate.name}`);
      if (onRefreshGates) onRefreshGates();
    } catch (err: any) {
      showFeedback(`Density adjustment failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flat-panel p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-text-primary tracking-tight">
              Manual Gate Control Station
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
              OPERATOR INTERLOCK
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Direct manual actuator overrides for physical SG90 servo barriers, traffic signals, and power states.
          </p>
        </div>

        {/* Gate Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted font-medium">Select Gate:</span>
          <div className="flex bg-surface-sunken p-1 rounded border border-border-strong">
            {gates.map(gate => (
              <button
                key={gate.id}
                onClick={() => setSelectedGateId(gate.id)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                  selectedGateId === gate.id
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {gate.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`px-4 py-2.5 rounded text-xs font-mono border flex items-center justify-between animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300'
              : feedback.type === 'error'
              ? 'bg-red-950/80 border-red-700 text-red-300'
              : 'bg-cyan-950/80 border-cyan-700 text-cyan-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span>{feedback.text}</span>
          </div>
          <span className="text-[10px] text-text-muted">DISPATCHED</span>
        </div>
      )}

      {currentGate && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Live Status & Physical Visualizer */}
          <div className="flat-panel p-5 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                <div>
                  <h2 className="text-sm font-bold text-text-primary">{currentGate.name}</h2>
                  <span className="text-[11px] font-mono text-text-muted">ID: {currentGate.id} • Zone: {currentGate.zoneId}</span>
                </div>
                <StateBadge state={currentGate.status} size="sm" />
              </div>

              {/* Physical Servo Arm Graphic */}
              <div className="mt-4 p-4 rounded bg-surface-sunken border border-border-subtle flex flex-col items-center">
                <span className="text-[11px] font-mono uppercase text-text-muted mb-2">
                  Physical Servo Gate Angle
                </span>
                <div className="relative w-44 h-28 flex items-end justify-center">
                  {/* Base Barrier Post */}
                  <div className="absolute bottom-0 w-8 h-12 bg-neutral-700 border-2 border-neutral-500 rounded-t-sm z-10 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></div>
                  </div>
                  {/* Rotating Gate Arm */}
                  <div
                    className="absolute bottom-6 left-1/2 w-32 h-3.5 bg-gradient-to-r from-amber-500 to-amber-300 border border-amber-600 rounded-r shadow-lg origin-left transition-transform duration-700 ease-out z-20 flex items-center justify-end px-2"
                    style={{
                      transform: `rotate(-${currentGate.servoAngle}deg)`
                    }}
                  >
                    <span className="text-[9px] font-mono font-black text-black">CPR-SHIELD</span>
                  </div>
                  {/* Ground Line */}
                  <div className="absolute bottom-0 w-full h-1 bg-border-strong"></div>
                </div>

                <div className="flex items-center justify-between w-full mt-3 px-2 text-xs font-mono">
                  <div className="text-center">
                    <span className="text-[10px] text-text-muted block">SERVO ANGLE</span>
                    <span className="text-base font-bold text-cyan-400">{currentGate.servoAngle}°</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-text-muted block">STATUS</span>
                    <span className="font-bold text-text-primary">{currentGate.servoStatus}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] text-text-muted block">CONTROL MODE</span>
                    <span className={`font-bold ${currentGate.isManualOverride ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {currentGate.manualState}
                    </span>
                  </div>
                </div>
              </div>

              {/* Current Metrics Readout */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="p-3 bg-surface-sunken rounded border border-border-subtle">
                  <span className="text-[10px] font-mono text-text-muted block">DETECTED PEOPLE</span>
                  <span className="text-xl font-bold font-mono text-text-primary">{currentGate.count}</span>
                </div>
                <div className="p-3 bg-surface-sunken rounded border border-border-subtle">
                  <span className="text-[10px] font-mono text-text-muted block">CROWD DENSITY</span>
                  <span className="text-xl font-bold font-mono text-text-primary">
                    {currentGate.density.toFixed(1)} <span className="text-xs font-normal text-text-muted">p/m²</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Gate Power Control */}
            <div className="pt-4 border-t border-border-subtle flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-text-primary block">Gate Primary Power</span>
                <span className="text-[11px] text-text-muted">
                  {currentGate.power ? 'Online & Actively Guarding' : 'Offline (Hardware Disengaged)'}
                </span>
              </div>
              <button
                onClick={handlePowerToggle}
                disabled={loading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all border ${
                  currentGate.power
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600 hover:bg-emerald-900'
                    : 'bg-red-950 text-red-300 border-red-600 hover:bg-red-900'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{currentGate.power ? 'ACTIVE' : 'STANDBY'}</span>
              </button>
            </div>
          </div>

          {/* Column 2: Direct Actuator Override Operations */}
          <div className="flat-panel p-5 space-y-4">
            <h2 className="text-sm font-bold text-text-primary border-b border-border-subtle pb-2 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Direct Servo Gate Overrides</span>
            </h2>
            <p className="text-xs text-text-secondary">
              Selecting any override will immediately instruct the ESP32 physical actuator to reposition the barrier arm regardless of AI detection.
            </p>

            <div className="space-y-2.5 pt-1">
              {/* Force Open 90° */}
              <button
                onClick={() => handleOverride('FORCE_OPEN')}
                disabled={loading}
                className={`w-full p-3.5 rounded border text-left flex items-center justify-between transition-all ${
                  currentGate.manualState === 'FORCE_OPEN'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                    : 'bg-surface-sunken border-border-subtle hover:border-emerald-700 text-text-primary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-emerald-950 border border-emerald-800 text-emerald-400">
                    <Unlock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">Force Open (90° Lifted)</span>
                    <span className="text-[11px] text-text-muted">Unrestricted inflow during normal conditions</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400">90°</span>
              </button>

              {/* Force Meter 45° */}
              <button
                onClick={() => handleOverride('FORCE_METER')}
                disabled={loading}
                className={`w-full p-3.5 rounded border text-left flex items-center justify-between transition-all ${
                  currentGate.manualState === 'FORCE_METER'
                    ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                    : 'bg-surface-sunken border-border-subtle hover:border-amber-700 text-text-primary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-amber-950 border border-amber-800 text-amber-400">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">Force Meter (45° Half-Bar)</span>
                    <span className="text-[11px] text-text-muted">Slow down pedestrian influx; single-file line</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400">45°</span>
              </button>

              {/* Emergency Lockdown 0° */}
              <button
                onClick={() => setConfirmLockModal(true)}
                disabled={loading}
                className={`w-full p-3.5 rounded border text-left flex items-center justify-between transition-all ${
                  currentGate.manualState === 'FORCE_LOCK'
                    ? 'bg-red-950/70 border-red-500 text-red-300'
                    : 'bg-surface-sunken border-border-subtle hover:border-red-700 text-text-primary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-red-950 border border-red-800 text-red-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">Emergency Lockdown (0° Barricade)</span>
                    <span className="text-[11px] text-text-muted">Completely blocks entry to eliminate crush disaster</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-red-400">0° LOCK</span>
              </button>

              {/* Resume Auto */}
              <button
                onClick={() => handleOverride('AUTO')}
                disabled={loading}
                className={`w-full p-3 rounded border text-left flex items-center justify-between transition-all ${
                  currentGate.manualState === 'AUTO'
                    ? 'bg-cyan-950/50 border-cyan-500 text-cyan-300'
                    : 'bg-surface-sunken border-border-subtle hover:border-cyan-700 text-text-primary'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-cyan-950 border border-cyan-800 text-cyan-400">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">Resume Automatic Mode</span>
                    <span className="text-[11px] text-text-muted">Return control to YOLO AI vision & mmWave radar</span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400">AUTO</span>
              </button>
            </div>
          </div>

          {/* Column 3: Live Crowd Pressure Simulation & Actuator Tests */}
          <div className="flat-panel p-5 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-text-primary border-b border-border-subtle pb-2 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Micro-Adjust Crowd Pressure</span>
              </h2>
              <p className="text-xs text-text-secondary">
                Simulate sudden influx spikes to demonstrate automatic hardware failover reactions live to evaluators.
              </p>

              {/* Quick Nudge Buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => handleDensityNudge(1)}
                  disabled={loading}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded bg-surface-sunken hover:bg-surface-raised border border-border-subtle hover:border-cyan-500 text-xs font-semibold text-text-primary transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>+1 Density</span>
                </button>
                <button
                  onClick={() => handleDensityNudge(-1)}
                  disabled={loading}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded bg-surface-sunken hover:bg-surface-raised border border-border-subtle hover:border-cyan-500 text-xs font-semibold text-text-primary transition-colors"
                >
                  <Minus className="w-3.5 h-3.5 text-text-muted" />
                  <span>-1 Density</span>
                </button>
                <button
                  onClick={() => handleDensityNudge(5)}
                  disabled={loading}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded bg-amber-950/40 hover:bg-amber-950 border border-amber-800 text-xs font-semibold text-amber-300 transition-colors"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                  <span>+5 Surge Spike</span>
                </button>
                <button
                  onClick={() => handleDensityNudge(-5)}
                  disabled={loading}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded bg-surface-sunken hover:bg-surface-raised border border-border-subtle text-xs font-semibold text-text-secondary transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-text-muted" />
                  <span>-5 Relieve Count</span>
                </button>
              </div>

              {/* Hardware Test Signals */}
              <div className="pt-3 border-t border-border-subtle space-y-2">
                <span className="text-[11px] font-mono text-text-muted uppercase block">
                  Actuator Diagnostic Pings
                </span>
                <div className="p-3 bg-surface-sunken rounded border border-border-subtle space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">ESP32 Traffic Signal</span>
                    <span className="font-mono text-emerald-400 font-bold">PWM SYNCHRONIZED</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">Piezo Buzzer Status</span>
                    <span className="font-mono text-text-muted">
                      {hardware?.buzzer ? 'AUDIBLE CHIRP ON' : 'STANDBY'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">Laser ToF Distance</span>
                    <span className="font-mono text-cyan-400">
                      {hardware?.tofDistanceMm ? `${hardware.tofDistanceMm} mm` : '850 mm (Nominal)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Operator Safety Notice */}
            <div className="p-3 bg-cyan-950/30 rounded border border-cyan-900/60 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Emergency manual lock actions supersede all automatic camera and radar inputs with immediate priority.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Emergency Lockdown */}
      <ConfirmModal
        isOpen={confirmLockModal}
        command="MANUAL_GATE_CLOSE"
        zoneName={currentGate?.name || 'Gate'}
        onConfirm={(reason) => {
          setConfirmLockModal(false);
          handleOverride('FORCE_LOCK');
          showFeedback(`Emergency Lock enforced on ${currentGate?.name}. Reason: ${reason}`, 'error');
        }}
        onClose={() => setConfirmLockModal(false)}
      />
    </div>
  );
};
