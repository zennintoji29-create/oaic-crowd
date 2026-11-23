import React, { useState, useEffect } from 'react';
import {
  Shield,
  KeyRound,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronRight,
  ArrowLeft,
  Server,
  Save,
  RotateCcw
} from 'lucide-react';
import { SystemConfig } from '../types';
import { fetchSystemConfig, updateSystemConfig } from '../lib/api';

interface InitialSetupProps {
  onSetupComplete: () => void;
  onBackToLanding: () => void;
}

export const InitialSetup: React.FC<InitialSetupProps> = ({
  onSetupComplete,
  onBackToLanding
}) => {
  const [gateName, setGateName] = useState<string>('Main Temple Gate Alpha');
  const [gateId, setGateId] = useState<string>('gate-a');
  const [passcode, setPasscode] = useState<string>('admin123');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [amberThreshold, setAmberThreshold] = useState<number>(5);
  const [redThreshold, setRedThreshold] = useState<number>(10);
  const [autoFailover, setAutoFailover] = useState<boolean>(true);
  const [buzzerAlerts, setBuzzerAlerts] = useState<boolean>(true);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load existing config on mount
  useEffect(() => {
    async function load() {
      try {
        const cfg = await fetchSystemConfig();
        if (cfg) {
          if (cfg.gateName) setGateName(cfg.gateName);
          if (cfg.gateId) setGateId(cfg.gateId);
          if (cfg.passcode) setPasscode(cfg.passcode);
          if (typeof cfg.amberThreshold === 'number') setAmberThreshold(cfg.amberThreshold);
          if (typeof cfg.redThreshold === 'number') setRedThreshold(cfg.redThreshold);
          if (typeof cfg.autoFailover === 'boolean') setAutoFailover(cfg.autoFailover);
          if (typeof cfg.buzzerAlerts === 'boolean') setBuzzerAlerts(cfg.buzzerAlerts);
        }
      } catch (e) {
        // Fallback to local storage
        const saved = localStorage.getItem('cpr_system_config');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.gateName) setGateName(parsed.gateName);
            if (parsed.passcode) setPasscode(parsed.passcode);
          } catch {}
        }
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation
    if (!gateName.trim() || gateName.trim().length < 3) {
      setErrorMessage('Please enter a valid Gate Name (at least 3 characters).');
      return;
    }

    if (!passcode || passcode.length < 4) {
      setErrorMessage('Operator password must be at least 4 characters for safety verification.');
      return;
    }

    if (amberThreshold >= redThreshold) {
      setErrorMessage('Amber Warning threshold must be strictly lower than Red Lockdown threshold.');
      return;
    }

    setIsLoading(true);
    try {
      const payload: Partial<SystemConfig> = {
        gateName: gateName.trim(),
        gateId,
        passcode,
        amberThreshold,
        redThreshold,
        autoFailover,
        buzzerAlerts
      };

      // Persist to backend
      await updateSystemConfig(payload);

      // Also persist to localStorage for offline persistence
      localStorage.setItem('cpr_system_config', JSON.stringify({
        ...payload,
        isConfigured: true,
        configuredAt: Date.now()
      }));

      setSuccessMessage('Smart Gate configuration saved & deployed successfully!');
      setTimeout(() => {
        onSetupComplete();
      }, 900);
    } catch (err: any) {
      setErrorMessage(`Failed to save configuration: ${err.message || 'Network error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-cyan-500 selection:text-slate-950">
      
      {/* Top Header */}
      <header className="border-b border-slate-800 px-4 lg:px-8 py-4 flex items-center justify-between bg-slate-950/80 backdrop-blur-md">
        <button
          onClick={onBackToLanding}
          className="flex items-center gap-2 text-xs font-mono text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Landing Page</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-mono font-bold text-slate-300">
            INITIAL GATE DEPLOYMENT SETUP
          </span>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-xl bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          
          {/* Subtle Ambient Top Accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-600" />

          {/* Form Header */}
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400 shadow-lg">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight font-mono">
                Smart Gate Setup
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure primary gate identifier, security passcode & safety thresholds.
              </p>
            </div>
          </div>

          {/* Alerts / Error feedback */}
          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs font-mono flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3 rounded-xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-200 text-xs font-mono flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            
            {/* Gate Identifier & Slot Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1.5">
                  Gate Hardware Slot
                </label>
                <select
                  value={gateId}
                  onChange={(e) => setGateId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400 transition"
                >
                  <option value="gate-a">Gate A (Primary Entrance Chute)</option>
                  <option value="gate-b">Gate B (North Pavilion Corridor)</option>
                  <option value="gate-c">Gate C (Perimeter Overflow)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase mb-1.5">
                  Gate Display Name
                </label>
                <input
                  type="text"
                  value={gateName}
                  onChange={(e) => setGateName(e.target.value)}
                  placeholder="e.g. Main Temple Gate Alpha"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition"
                />
              </div>
            </div>

            {/* Operator Passcode */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase">
                  Admin / Operator Passcode
                </label>
                <span className="text-[10px] text-slate-500 font-mono">For manual lock overrides</span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter 4+ char password"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Threshold Sliders */}
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wide block">
                Automatic Actuator Thresholds
              </span>

              {/* Amber Warning Threshold */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-amber-400 font-semibold">Caution Metering (Yellow / 45° Gate):</span>
                  <span className="font-bold text-white">{amberThreshold} Persons</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="15"
                  value={amberThreshold}
                  onChange={(e) => setAmberThreshold(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              {/* Red Lockdown Threshold */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-rose-400 font-semibold">Emergency Lockdown (Red / 0° Gate):</span>
                  <span className="font-bold text-white">{redThreshold} Persons</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="25"
                  value={redThreshold}
                  onChange={(e) => setRedThreshold(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
              </div>
            </div>

            {/* Safety Feature Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={autoFailover}
                  onChange={(e) => setAutoFailover(e.target.checked)}
                  className="w-4 h-4 rounded accent-cyan-400 cursor-pointer"
                />
                <span className="text-slate-300">Autonomous Radar Failover</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={buzzerAlerts}
                  onChange={(e) => setBuzzerAlerts(e.target.checked)}
                  className="w-4 h-4 rounded accent-cyan-400 cursor-pointer"
                />
                <span className="text-slate-300">Audible Alarm on Lock</span>
              </label>
            </div>

            {/* Submit Action */}
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full sm:flex-1 py-3 rounded-xl font-mono text-xs font-bold bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-xl shadow-cyan-500/20 transition flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{isLoading ? 'Saving Configuration...' : 'Save & Deploy Gate Setup'}</span>
              </button>

              <button
                type="button"
                onClick={onSetupComplete}
                className="w-full sm:w-auto px-5 py-3 rounded-xl font-mono text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                Skip to Dashboard
              </button>
            </div>

          </form>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs font-mono text-slate-600 border-t border-slate-900">
        Settings are saved to backend REST API & mirrored to local browser storage.
      </footer>

    </div>
  );
};
