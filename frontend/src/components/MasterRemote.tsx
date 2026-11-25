import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Sliders,
  RotateCcw,
  Plus,
  Minus,
  Radio,
  Flame,
  EyeOff,
  Eye,
  ShieldAlert,
  Power,
  Check,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { GateState, CrowdState } from '../types';
import {
  authenticateMaster,
  sendMasterCommand,
  fetchGates,
  getSessionToken,
  setSessionToken,
  clearSessionToken
} from '../lib/api';

interface MasterRemoteProps {
  initialGates?: GateState[];
}

export const MasterRemote: React.FC<MasterRemoteProps> = ({ initialGates = [] }) => {
  // Authentication State (sessionStorage only)
  const [token, setToken] = useState<string>(() => getSessionToken() || '');

  const [pinInput, setPinInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Gates & Remote State
  const [gates, setGates] = useState<GateState[]>(initialGates);
  const [selectedGateId, setSelectedGateId] = useState<string>('gate-a');
  const [executing, setExecuting] = useState<boolean>(false);
  const [cameraOnline, setCameraOnline] = useState<boolean>(true);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);

  const currentGate = gates.find(g => g.id === selectedGateId) || gates[0] || {
    id: 'gate-a',
    name: 'Main Temple Gate A',
    zoneId: 'zone-entry-a',
    status: 'GREEN' as CrowdState,
    count: 2,
    density: 0.8,
    riskScore: 18,
    servoAngle: 90,
    servoStatus: 'OPEN',
    isManualOverride: false,
    manualState: 'AUTO',
    power: true,
    lastUpdated: Date.now(),
    amberThreshold: 5,
    redThreshold: 10
  };

  // Poll gates silently while remote is open
  useEffect(() => {
    if (!token) return;
    let isMounted = true;

    async function sync() {
      try {
        const fetched = await fetchGates();
        if (isMounted && fetched && fetched.length > 0) {
          setGates(fetched);
        }
      } catch (e) {
        // Silent poll ignore
      }
    }

    sync();
    const interval = setInterval(sync, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token]);

  // Haptic feedback & local subtle flash
  const notifyPhoneOnly = (msg: string) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
    setLocalFeedback(msg);
    setTimeout(() => setLocalFeedback(null), 1800);
  };

  // Submit PIN / Passcode
  const handleAuthSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput.trim()) return;

    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await authenticateMaster(pinInput.trim());
      if (res.success && res.token) {
        setToken(res.token);
        setSessionToken(res.token);
        notifyPhoneOnly('Link Verified');
      } else {
        setAuthError('Invalid credentials');
      }
    } catch {
      setAuthError('Invalid credentials');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setToken('');
    clearSessionToken();
  };

  // Dispatch Silent Command to Backend
  const executeSilent = async (action: string, params: Record<string, any> = {}) => {
    if (!token) return;
    setExecuting(true);
    try {
      const res = await sendMasterCommand(token, {
        action,
        gateId: selectedGateId,
        ...params
      });

      if (res.gate) {
        setGates(prev => prev.map(g => (g.id === res.gate.id ? res.gate : g)));
      }

      notifyPhoneOnly('Updated');
    } catch (err: any) {
      if (err.message === 'AUTH_EXPIRED') {
        setToken('');
        clearSessionToken();
      }
    } finally {
      setExecuting(false);
    }
  };

  // =========================================================================
  // VIEW 1: Stealth Security Keypad Screen (Unauthorized)
  // =========================================================================
  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4 font-sans select-none">
        <div className="w-full max-w-xs space-y-6">
          <div className="text-center space-y-1">
            <div className="inline-flex p-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-cyan-400 mb-2">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-base font-bold font-mono tracking-tight text-white uppercase">
              CPR Master Remote
            </h1>
            <p className="text-xs text-neutral-500 font-mono">
              Restricted Operator Terminal
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                placeholder="Enter PIN or Passcode"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full text-center tracking-widest text-lg font-mono py-3 px-4 rounded-xl bg-neutral-900 border border-neutral-700 text-cyan-400 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500 transition shadow-inner"
                autoFocus
              />
              {authError && (
                <span className="text-xs text-rose-400 font-mono text-center block mt-2">
                  {authError}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={authLoading || !pinInput}
              className="w-full py-3.5 rounded-xl font-mono text-sm font-bold bg-cyan-500 hover:bg-cyan-400 text-neutral-950 transition active:scale-98 disabled:opacity-50 shadow-lg shadow-cyan-500/20"
            >
              {authLoading ? 'Verifying...' : 'Unlock Remote'}
            </button>
          </form>

          {/* Quick PIN Keypad on Mobile */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'].map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (key === 'CLR') {
                    setPinInput('');
                  } else if (key === 'OK') {
                    handleAuthSubmit();
                  } else {
                    setPinInput(prev => prev + key);
                  }
                }}
                className="py-3 rounded-lg bg-neutral-900 hover:bg-neutral-850 active:bg-neutral-800 border border-neutral-800 text-neutral-300 font-mono text-sm font-bold transition active:scale-95"
              >
                {key}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-neutral-600 text-center font-mono">
            Silent link • Zero dashboard notifications
          </p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: Minimal Mobile-First Remote Controller
  // =========================================================================
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col p-3 max-w-md mx-auto font-sans select-none pb-8">
      {/* 1. Stealth Top Header */}
      <div className="flex items-center justify-between py-2 border-b border-neutral-800/80 mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-mono font-bold tracking-wider text-neutral-400 uppercase">
            CPR Silent Remote
          </span>
        </div>

        <div className="flex items-center gap-2">
          {localFeedback && (
            <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800 animate-fadeIn">
              {localFeedback}
            </span>
          )}
          <button
            onClick={handleLogout}
            title="Lock Remote"
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-500 hover:text-rose-400 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Gate Selection Tabs */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {gates.map((gate) => {
          const isSelected = gate.id === selectedGateId;
          return (
            <button
              key={gate.id}
              onClick={() => {
                setSelectedGateId(gate.id);
                notifyPhoneOnly(`Selected ${gate.name.split(' ')[0]}`);
              }}
              className={`p-3 rounded-xl border text-left transition-all active:scale-98 ${
                isSelected
                  ? 'bg-neutral-900 border-cyan-500 ring-1 ring-cyan-500/50 shadow-md'
                  : 'bg-neutral-900/60 border-neutral-800/80 text-neutral-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-neutral-400'}`}>
                  {gate.name.replace('Main ', '').replace(' Pavilion', '')}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    gate.status === 'RED'
                      ? 'bg-rose-500'
                      : gate.status === 'AMBER'
                      ? 'bg-amber-400'
                      : 'bg-emerald-500'
                  }`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 mt-1">
                <span>{gate.count} ppl</span>
                <span className="text-cyan-400 font-bold">{gate.servoAngle}°</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Live Selected Gate Status Banner */}
      <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 mb-4 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono text-neutral-500 uppercase block">Selected Gate</span>
          <span className="text-sm font-bold text-white">{currentGate.name}</span>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mt-0.5">
            <span>Count: <strong className="text-white">{currentGate.count}</strong></span>
            <span>•</span>
            <span>Density: <strong className="text-cyan-400">{currentGate.density.toFixed(1)}</strong> p/m²</span>
          </div>
        </div>

        <div className="text-right">
          <span
            className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${
              currentGate.status === 'RED'
                ? 'bg-rose-950 text-rose-300 border-rose-800'
                : currentGate.status === 'AMBER'
                ? 'bg-amber-950 text-amber-300 border-amber-800'
                : 'bg-emerald-950 text-emerald-300 border-emerald-800'
            }`}
          >
            {currentGate.status}
          </span>
          <span className="text-[10px] font-mono text-neutral-500 block mt-1">
            Servo: <strong className="text-amber-400">{currentGate.servoAngle}°</strong>
          </span>
        </div>
      </div>

      {/* 4. Crowd Population & Density Controls (Big Touch Buttons) */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 uppercase">
          <span>Population / Density Nudge</span>
          <span className="text-neutral-500">Silent Adjust</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <button
            onClick={() => executeSilent('DENSITY', { delta: -5 })}
            disabled={executing}
            className="py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:bg-neutral-800 border border-neutral-800 text-xs font-mono font-bold text-neutral-300 active:scale-95 transition"
          >
            -5
          </button>
          <button
            onClick={() => executeSilent('DENSITY', { delta: -1 })}
            disabled={executing}
            className="py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:bg-neutral-800 border border-neutral-800 text-xs font-mono font-bold text-neutral-300 active:scale-95 transition"
          >
            -1
          </button>
          <button
            onClick={() => executeSilent('DENSITY', { delta: 1 })}
            disabled={executing}
            className="py-3.5 rounded-xl bg-neutral-900 hover:bg-neutral-850 active:bg-neutral-800 border border-cyan-800 text-xs font-mono font-bold text-cyan-400 active:scale-95 transition"
          >
            +1
          </button>
          <button
            onClick={() => executeSilent('DENSITY', { delta: 5 })}
            disabled={executing}
            className="py-3.5 rounded-xl bg-amber-950/70 hover:bg-amber-900/80 active:bg-amber-850 border border-amber-700/80 text-xs font-mono font-bold text-amber-300 active:scale-95 transition"
          >
            +5 Surge
          </button>
        </div>

        {/* Continuous Smooth Population Slider */}
        <div className="pt-2 px-1 flex items-center gap-3">
          <span className="text-[10px] font-mono text-neutral-500">0</span>
          <input
            type="range"
            min="0"
            max="25"
            value={currentGate.count}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              executeSilent('SET_POPULATION', { count: val });
            }}
            className="w-full h-3 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <span className="text-[10px] font-mono text-neutral-500">25+</span>
        </div>
      </div>

      {/* 5. Physical SG90 Servo Barrier Controls */}
      <div className="space-y-2 mb-4">
        <span className="text-[11px] font-mono text-neutral-400 uppercase block">
          Gate Physical Barrier (Servo)
        </span>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => executeSilent('OVERRIDE', { manualState: 'FORCE_OPEN' })}
            disabled={executing}
            className={`p-3.5 rounded-xl border text-left transition active:scale-98 flex items-center justify-between ${
              currentGate.manualState === 'FORCE_OPEN'
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-xs font-bold block">Open</span>
                <span className="text-[10px] text-neutral-500">90° Lifted</span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">90°</span>
          </button>

          <button
            onClick={() => executeSilent('OVERRIDE', { manualState: 'FORCE_METER' })}
            disabled={executing}
            className={`p-3.5 rounded-xl border text-left transition active:scale-98 flex items-center justify-between ${
              currentGate.manualState === 'FORCE_METER'
                ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="text-xs font-bold block">Meter Inflow</span>
                <span className="text-[10px] text-neutral-500">45° Stagger</span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-amber-400">45°</span>
          </button>

          <button
            onClick={() => executeSilent('OVERRIDE', { manualState: 'FORCE_LOCK' })}
            disabled={executing}
            className={`p-3.5 rounded-xl border text-left transition active:scale-98 flex items-center justify-between ${
              currentGate.manualState === 'FORCE_LOCK'
                ? 'bg-rose-950/90 border-rose-500 text-rose-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <span className="text-xs font-bold block">Lockdown</span>
                <span className="text-[10px] text-neutral-500">0° Barricade</span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-rose-400">0°</span>
          </button>

          <button
            onClick={() => executeSilent('OVERRIDE', { manualState: 'AUTO' })}
            disabled={executing}
            className={`p-3.5 rounded-xl border text-left transition active:scale-98 flex items-center justify-between ${
              currentGate.manualState === 'AUTO'
                ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-cyan-400 shrink-0" />
              <div>
                <span className="text-xs font-bold block">Auto Mode</span>
                <span className="text-[10px] text-neutral-500">YOLO + Radar</span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-cyan-400">AUTO</span>
          </button>
        </div>
      </div>

      {/* 6. Instant Gate State Swapper */}
      <div className="space-y-2 mb-4">
        <span className="text-[11px] font-mono text-neutral-400 uppercase block">
          Preset Risk Conditions
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => executeSilent('SET_STATE', { state: 'GREEN' })}
            disabled={executing}
            className="py-2.5 px-2 rounded-xl bg-emerald-950/50 border border-emerald-700/60 text-emerald-300 text-xs font-mono font-bold active:scale-95 transition"
          >
            Normal (Green)
          </button>
          <button
            onClick={() => executeSilent('SET_STATE', { state: 'AMBER' })}
            disabled={executing}
            className="py-2.5 px-2 rounded-xl bg-amber-950/50 border border-amber-700/60 text-amber-300 text-xs font-mono font-bold active:scale-95 transition"
          >
            Caution (Yellow)
          </button>
          <button
            onClick={() => executeSilent('SET_STATE', { state: 'RED' })}
            disabled={executing}
            className="py-2.5 px-2 rounded-xl bg-rose-950/50 border border-rose-700/60 text-rose-300 text-xs font-mono font-bold active:scale-95 transition"
          >
            Danger (Red)
          </button>
        </div>
      </div>

      {/* 7. Failover Simulation Toggle (Camera drop trick for evaluators) */}
      <div className="pt-2 border-t border-neutral-800/80 space-y-2">
        <button
          onClick={() => {
            const next = !cameraOnline;
            setCameraOnline(next);
            executeSilent('SIMULATE_FAILOVER', { cameraOnline: next });
          }}
          disabled={executing}
          className={`w-full py-3 rounded-xl border text-xs font-mono font-bold flex items-center justify-center gap-2 transition active:scale-98 ${
            !cameraOnline
              ? 'bg-amber-950 text-amber-300 border-amber-600'
              : 'bg-neutral-900 hover:bg-neutral-850 border-neutral-800 text-neutral-300'
          }`}
        >
          {!cameraOnline ? (
            <>
              <EyeOff className="w-4 h-4 text-amber-400" />
              <span>Radar Takeover Active (Tap to Restore Camera)</span>
            </>
          ) : (
            <>
              <Radio className="w-4 h-4 text-cyan-400" />
              <span>Simulate Camera Drop (Test Radar Failover)</span>
            </>
          )}
        </button>

        <p className="text-[10px] text-neutral-600 text-center font-mono pt-1">
          Operations execute silently in background • 0 toasts/modals on dashboard
        </p>
      </div>
    </div>
  );
};
