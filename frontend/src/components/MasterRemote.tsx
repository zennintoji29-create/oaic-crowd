import React, { useState, useEffect } from 'react';
import {
  Lock,
  Unlock,
  Sliders,
  RotateCcw,
  Radio,
  EyeOff,
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
  const [token, setToken] = useState<string>(() => getSessionToken() || '');
  const [pinInput, setPinInput] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  const [gates, setGates] = useState<GateState[]>(initialGates);
  const [selectedGateId, setSelectedGateId] = useState<string>('gate-a');
  const [executing, setExecuting] = useState<boolean>(false);
  const [cameraOnline, setCameraOnline] = useState<boolean>(true);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);

  // Strict whole-number input box state (digits 0-9 only)
  const [amountInput, setAmountInput] = useState<string>('1');

  const currentGate = gates.find((g) => g.id === selectedGateId) || gates[0] || {
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

  useEffect(() => {
    if (!token) return;
    let isMounted = true;

    async function sync() {
      try {
        const fetched = await fetchGates();
        if (isMounted && fetched && fetched.length > 0) {
          setGates(fetched);
        }
      } catch {
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

  const notifyPhoneOnly = (msg: string) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
    setLocalFeedback(msg);
    setTimeout(() => setLocalFeedback(null), 1800);
  };

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
        setGates((prev) => prev.map((g) => (g.id === res.gate.id ? res.gate : g)));
      }

      if (action === 'RESET_ALL') {
        setCameraOnline(true);
        const freshGates = await fetchGates().catch(() => []);
        if (freshGates.length > 0) setGates(freshGates);
        notifyPhoneOnly('Reset to Live');
      } else {
        notifyPhoneOnly('Updated');
      }
    } catch (err: any) {
      if (err.message === 'AUTH_EXPIRED') {
        setToken('');
        clearSessionToken();
      }
    } finally {
      setExecuting(false);
    }
  };

  // Clamp population delta so count never goes below 0
  const applyPopulationDelta = (delta: number) => {
    const nextCount = Math.max(0, currentGate.count + delta);
    const clampedDelta = nextCount - currentGate.count;
    executeSilent('DENSITY', { delta: clampedDelta });
  };

  // Strict whole-number sanitization: digits 0-9 only (no decimals, letters, minus, spaces)
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
    setAmountInput(digitsOnly);
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const blocked = ['.', '-', '+', 'e', 'E', ' '];
    if (blocked.includes(e.key)) {
      e.preventDefault();
    }
  };

  const parsedAmount = amountInput === '' ? 0 : parseInt(amountInput, 10);

  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4 font-sans select-none">
        <div className="w-full max-w-xs space-y-6">
          <div className="text-center space-y-1">
            <div className="inline-flex p-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-emerald-400 mb-2">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-base font-bold font-mono tracking-tight text-white uppercase">
              CPR Master Remote
            </h1>
            <p className="text-xs text-neutral-500 font-mono">Restricted Operator Terminal</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Enter PIN or Passcode"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full text-center tracking-widest text-lg font-mono py-3 px-4 rounded-xl bg-neutral-900 border border-neutral-700 text-emerald-400 placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 transition shadow-inner"
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
              className="w-full py-3.5 rounded-xl font-mono text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-neutral-950 transition disabled:opacity-50"
            >
              {authLoading ? 'Verifying...' : 'Unlock Remote'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-surface-base text-text-primary flex flex-col p-4 max-w-md mx-auto font-sans select-none pb-8 safe-area-shell">
      {/* Top Header with Reset & Logout */}
      <div className="flex items-center justify-between py-2 border-b border-border-subtle mb-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />
          <span className="text-xs font-semibold tracking-wider text-text-secondary uppercase">
            CPR Master Remote
          </span>
        </div>

        <div className="flex items-center gap-2">
          {localFeedback && (
            <span className="text-[11px] font-semibold text-status-clear-text bg-status-clear-bg px-2 py-1 rounded border border-status-clear-border">
              {localFeedback}
            </span>
          )}
          <button
            type="button"
            onClick={() => executeSilent('RESET_ALL')}
            disabled={executing}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-status-danger-bg border border-status-danger-border text-status-danger-text hover:opacity-90 text-xs font-semibold transition-opacity"
            title="Reset all controls back to live data"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Lock remote and sign out"
            title="Lock Remote"
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md bg-surface-raised border border-border-strong text-text-muted hover:text-status-danger-text transition-colors"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Gate Selection Tabs */}
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
              className={`p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-neutral-900 border-emerald-500 ring-1 ring-emerald-500/50 shadow-md'
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
                <span className="text-emerald-400 font-bold">{gate.servoAngle}°</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Live Selected Gate Status Banner */}
      <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 mb-4 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono text-neutral-500 uppercase block">Selected Gate</span>
          <span className="text-sm font-bold text-white">{currentGate.name}</span>
          <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 mt-0.5">
            <span>Count: <strong className="text-white">{currentGate.count}</strong></span>
            <span>•</span>
            <span>Density: <strong className="text-emerald-400">{currentGate.density.toFixed(1)}</strong> p/m²</span>
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

      {/* People Count Number Box (+ Add / - Remove) & Quick Buttons */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 uppercase">
          <span>People Count Control</span>
          <span className="text-neutral-500">Whole numbers only</span>
        </div>

        {/* Number Box + Add / Remove */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={amountInput}
            onChange={handleAmountChange}
            onKeyDown={handleAmountKeyDown}
            placeholder="0"
            aria-label="Whole number of people to add or remove"
            className="w-24 text-center py-2.5 px-3 rounded-xl bg-neutral-900 border border-neutral-700 text-white font-mono text-sm font-bold focus:outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            disabled={executing || parsedAmount === 0}
            onClick={() => applyPopulationDelta(parsedAmount)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-neutral-950 text-xs font-mono font-bold transition disabled:opacity-40"
          >
            + Add
          </button>
          <button
            type="button"
            disabled={executing || parsedAmount === 0 || currentGate.count === 0}
            onClick={() => applyPopulationDelta(-parsedAmount)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 text-xs font-mono font-bold transition disabled:opacity-40"
          >
            - Remove
          </button>
        </div>

        {/* Quick Buttons: -5, -1, +1, +5, +10, +30 */}
        <div className="grid grid-cols-6 gap-1.5">
          {[-5, -1, 1, 5, 10, 30].map((val) => (
            <button
              key={val}
              type="button"
              disabled={executing || (val < 0 && currentGate.count === 0)}
              onClick={() => applyPopulationDelta(val)}
              className={`py-2.5 rounded-xl border text-xs font-mono font-bold transition active:scale-95 disabled:opacity-40 ${
                val > 0
                  ? 'bg-emerald-950/60 border-emerald-700/70 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {val > 0 ? `+${val}` : val}
            </button>
          ))}
        </div>
      </div>

      {/* Physical SG90 Servo Barrier Controls (90° = OPEN, 0° = LOCKED) */}
      <div className="space-y-2 mb-4">
        <span className="text-[11px] font-mono text-neutral-400 uppercase block">
          Gate Physical Barrier (Servo)
        </span>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => executeSilent('OVERRIDE', { manualState: 'FORCE_OPEN' })}
            disabled={executing}
            className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between ${
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
            className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between ${
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
            className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between ${
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
            className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between ${
              currentGate.manualState === 'AUTO'
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-200 hover:border-neutral-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-xs font-bold block">Auto Mode</span>
                <span className="text-[10px] text-neutral-500">YOLO + Radar</span>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400">AUTO</span>
          </button>
        </div>
      </div>

      {/* Instant Gate State Swapper */}
      <div className="space-y-2 mb-4">
        <span className="text-[11px] font-mono text-neutral-400 uppercase block">
          Preset Risk Conditions
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => executeSilent('SET_STATE', { state: 'GREEN' })}
            disabled={executing}
            className="py-2.5 px-2 rounded-xl bg-emerald-950/50 border border-emerald-700/60 text-emerald-300 text-xs font-mono font-bold"
          >
            Normal (Green)
          </button>
          <button
            onClick={() => executeSilent('SET_STATE', { state: 'AMBER' })}
            disabled={executing}
            className="py-2.5 px-2 rounded-xl bg-amber-950/50 border border-amber-700/60 text-amber-300 text-xs font-mono font-bold"
          >
            Caution (Yellow)
          </button>
          <button
            onClick={() => executeSilent('SET_STATE', { state: 'RED' })}
            disabled={executing}
            className="py-2.5 px-2 rounded-xl bg-rose-950/50 border border-rose-700/60 text-rose-300 text-xs font-mono font-bold"
          >
            Danger (Red)
          </button>
        </div>
      </div>

      {/* Failover Simulation Toggle & Full Reset */}
      <div className="pt-2 border-t border-neutral-800/80 space-y-2">
        <button
          onClick={() => {
            const next = !cameraOnline;
            setCameraOnline(next);
            executeSilent('SIMULATE_FAILOVER', { cameraOnline: next });
          }}
          disabled={executing}
          className={`w-full py-3 rounded-xl border text-xs font-mono font-bold flex items-center justify-center gap-2 transition ${
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
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>Simulate Camera Drop (Test Radar Failover)</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => executeSilent('RESET_ALL')}
          disabled={executing}
          className="w-full py-2.5 rounded-xl border border-emerald-700/60 bg-emerald-950/30 hover:bg-emerald-950/60 text-emerald-300 text-xs font-mono font-bold flex items-center justify-center gap-2 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Everything to Live Data</span>
        </button>
      </div>
    </div>
  );
};
