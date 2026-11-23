import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Radio,
  Sliders,
  Tv,
  Eye,
  Lock,
  Smartphone,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { GateState, HardwareActuatorState } from '../types';

interface LandingPageProps {
  onEnterDashboard: () => void;
  onOpenSetup: () => void;
  onOpenMaster: () => void;
  gates: GateState[];
  hardware: HardwareActuatorState | null;
  worstState: string;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onEnterDashboard,
  onOpenSetup,
  onOpenMaster,
  gates,
  hardware,
  worstState
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [activeScenario, setActiveScenario] = useState<'normal' | 'surge' | 'failover'>('normal');
  const [simProgress, setSimProgress] = useState<number>(35);

  // Video preview simulation loop
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSimProgress(prev => (prev >= 100 ? 0 : prev + 1));
    }, 150);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const gateA = gates.find(g => g.id === 'gate-a') || gates[0];
  const isRed = worstState === 'RED';
  const isAmber = worstState === 'AMBER';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      
      {/* 1. Top Utility Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/40">
            <Radio className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white font-mono">
                CROWD PRESSURE RADAR
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                v3.2 PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Smart Gate & Proactive Crowd Safety Platform
            </p>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onOpenMaster}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded-lg bg-fuchsia-950/70 text-fuchsia-300 border border-fuchsia-700/60 hover:bg-fuchsia-900/80 transition shadow-sm"
            title="Open Master Mobile Remote Control"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Master Remote</span>
          </button>

          <button
            onClick={onOpenSetup}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-lg bg-slate-900 text-slate-300 border border-slate-700 hover:border-slate-500 hover:text-white transition"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Gate Setup</span>
          </button>

          <button
            onClick={onEnterDashboard}
            className="flex items-center gap-2 px-4 py-1.5 text-xs font-mono font-bold rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 transition shadow-lg shadow-cyan-500/25"
          >
            <span>Enter Dashboard</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-12 pb-16 max-w-7xl mx-auto w-full flex flex-col items-center text-center">
        {/* Glow Accent */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-cyan-500/10 blur-[120px] pointer-events-none rounded-full" />

        {/* Live Status Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-xs font-mono mb-6 shadow-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-slate-300">SYSTEM STATUS:</span>
          <span className="text-emerald-400 font-bold">
            {hardware ? hardware.systemMode : 'AI_VISION_PRIMARY'}
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-cyan-400 font-medium">17.6 FPS CUDA GPU</span>
        </div>

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl leading-tight">
          Proactive Crowd Crush Prevention & <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">Smart Gate Physical Shield</span>
        </h1>

        <p className="mt-5 text-sm sm:text-base lg:text-lg text-slate-300 max-w-2xl leading-relaxed">
          Forensic evidence proves crowd stampede victims suffocate upright when density exceeds 6 people/m². 
          CPR combines <span className="text-cyan-300 font-semibold">NVIDIA CUDA Vision</span>, <span className="text-blue-300 font-semibold">24GHz mmWave Radar</span>, and <span className="text-emerald-300 font-semibold">automated micro-servo gate regulation</span> to eliminate crush hazards before they form.
        </p>

        {/* Hero Quick Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onEnterDashboard}
            className="px-6 py-3 rounded-xl font-mono text-sm font-bold bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-xl shadow-cyan-500/20 transition flex items-center gap-2 transform hover:-translate-y-0.5"
          >
            <Tv className="w-4 h-4" />
            <span>Launch Operational Dashboard</span>
          </button>

          <button
            onClick={onOpenMaster}
            className="px-6 py-3 rounded-xl font-mono text-sm font-bold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition flex items-center gap-2 transform hover:-translate-y-0.5"
          >
            <Smartphone className="w-4 h-4 text-fuchsia-400" />
            <span>Mobile Master Controller</span>
          </button>
        </div>

        {/* Live Metrics Quick Counters */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full max-w-4xl text-left font-mono">
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Edge Vision Speed</span>
            <span className="text-2xl font-bold text-cyan-400 mt-1 block">17.2 ms</span>
            <span className="text-[10px] text-slate-500">YOLO11n + ByteTrack CUDA</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Radar Penetration</span>
            <span className="text-2xl font-bold text-blue-400 mt-1 block">24 GHz</span>
            <span className="text-[10px] text-slate-500">Zero light / Smoke immunity</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Gate Response</span>
            <span className="text-2xl font-bold text-emerald-400 mt-1 block">&lt; 100 ms</span>
            <span className="text-[10px] text-slate-500">SG90 90°/45°/0° Metering</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Failover Latency</span>
            <span className="text-2xl font-bold text-amber-400 mt-1 block">4.5 sec</span>
            <span className="text-[10px] text-slate-500">Autonomous hardware takeover</span>
          </div>
        </div>
      </section>

      {/* 3. Interactive Prototype Demonstration Video / Screen Player */}
      <section className="px-4 sm:px-6 lg:px-8 py-8 max-w-6xl mx-auto w-full">
        <div className="border border-slate-800 rounded-3xl bg-slate-900/90 shadow-2xl overflow-hidden">
          
          {/* Player Top Bar */}
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500" />
              <span className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-xs font-mono font-bold text-slate-300 ml-2">
                PROTOTYPE DEMONSTRATION & OPTICAL RADAR FEED
              </span>
            </div>

            {/* Scenario Buttons */}
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                onClick={() => setActiveScenario('normal')}
                className={`px-2.5 py-1 rounded-md transition ${
                  activeScenario === 'normal'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                1. Normal Flow (&lt;5 PPL)
              </button>

              <button
                onClick={() => setActiveScenario('surge')}
                className={`px-2.5 py-1 rounded-md transition ${
                  activeScenario === 'surge'
                    ? 'bg-rose-950 text-rose-300 border border-rose-600'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                2. Surge Lockdown (14 PPL)
              </button>

              <button
                onClick={() => setActiveScenario('failover')}
                className={`px-2.5 py-1 rounded-md transition ${
                  activeScenario === 'failover'
                    ? 'bg-amber-950 text-amber-300 border border-amber-600'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                3. Radar Failover
              </button>
            </div>
          </div>

          {/* Screen Display Simulation */}
          <div className="relative aspect-video w-full bg-slate-950 flex flex-col justify-between p-4 md:p-6 overflow-hidden">
            
            {/* Ambient Background Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            {/* Top Video HUD Bar */}
            <div className="relative z-10 flex items-center justify-between text-xs font-mono bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-white font-bold">REC // CAM-01 [ENTRY CHUTE A]</span>
                <span className="text-slate-500 hidden sm:inline">| FPS: 17.6 (62.7ms)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-cyan-400 font-semibold">BACKEND: CUDA:0 (RTX 3050)</span>
                <span className="text-emerald-400 font-bold hidden md:inline">NET: ONLINE (PORT 3000)</span>
              </div>
            </div>

            {/* Center Visual Mockup based on active scenario */}
            <div className="relative z-10 flex-1 my-4 flex items-center justify-center">
              {activeScenario === 'normal' && (
                <div className="flex flex-col items-center gap-3 animate-fadeIn">
                  <div className="flex items-center gap-6">
                    {/* Person Bounding Box 1 */}
                    <div className="border-2 border-cyan-400 bg-cyan-950/20 rounded p-2 text-center shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                      <span className="text-[10px] font-mono bg-cyan-400 text-slate-950 font-bold px-1.5 py-0.5 rounded block">
                        ID #15 (73%)
                      </span>
                      <div className="w-16 h-28 my-1 flex items-center justify-center text-3xl">👤</div>
                      <span className="text-[9px] font-mono text-cyan-300">1.35 m/s</span>
                    </div>

                    {/* Person Bounding Box 2 */}
                    <div className="border-2 border-cyan-400 bg-cyan-950/20 rounded p-2 text-center shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                      <span className="text-[10px] font-mono bg-cyan-400 text-slate-950 font-bold px-1.5 py-0.5 rounded block">
                        ID #20 (90%)
                      </span>
                      <div className="w-16 h-28 my-1 flex items-center justify-center text-3xl">👤</div>
                      <span className="text-[9px] font-mono text-cyan-300">1.28 m/s</span>
                    </div>
                  </div>

                  <div className="px-4 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-600/80 text-emerald-300 font-mono text-xs font-bold">
                    ✓ STATUS: NORMAL FLOW (2 PERSONS) • GATE 90° OPEN • GREEN LIGHT
                  </div>
                </div>
              )}

              {activeScenario === 'surge' && (
                <div className="flex flex-col items-center gap-3 animate-fadeIn">
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="border border-rose-500 bg-rose-950/30 rounded p-1 text-center animate-pulse">
                        <span className="text-[9px] font-mono text-rose-300 block">ID #{21 + i}</span>
                        <div className="text-xl">👤</div>
                        <span className="text-[8px] font-mono text-rose-400 font-bold">0.05m/s</span>
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-2 rounded-xl bg-rose-950 border border-rose-500 text-rose-200 font-mono text-xs font-black shadow-lg shadow-rose-950/60 animate-bounce">
                    🚨 CRITICAL CROWD SURGE (14 PERSONS) • GATE LOCKED AT 0° • BUZZER ACTIVE
                  </div>
                </div>
              )}

              {activeScenario === 'failover' && (
                <div className="flex flex-col items-center gap-3 animate-fadeIn">
                  <div className="w-48 h-32 rounded-2xl border-2 border-amber-500 bg-amber-950/20 flex flex-col items-center justify-center gap-2 p-3 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                    <Radio className="w-8 h-8 text-amber-400 animate-spin" />
                    <span className="text-xs font-mono font-bold text-amber-300">24GHz mmWave Radar</span>
                    <span className="text-[10px] font-mono text-amber-400">Energy: 74% • Stationary Detected</span>
                  </div>

                  <div className="px-4 py-1.5 rounded-lg bg-amber-950 border border-amber-600 text-amber-200 font-mono text-xs font-bold">
                    ⚡ OPTICAL WATCHDOG TRIP • AUTONOMOUS RADAR FAILOVER TAKEOVER (45° METER)
                  </div>
                </div>
              )}
            </div>

            {/* Video Controls Bar */}
            <div className="relative z-10 flex flex-col gap-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              {/* Progress Bar */}
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full transition-all duration-200"
                  style={{ width: `${simProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-1.5 rounded hover:bg-slate-800 text-white transition"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setSimProgress(0)}
                    className="p-1.5 rounded hover:bg-slate-800 text-white transition"
                    title="Restart"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <span>01:14 / 03:30</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    LIVE TWIN SYNC
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. Core Architecture Pillars */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 max-w-7xl mx-auto w-full">
        <div className="text-center mb-12">
          <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">
            Technical Architecture
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white mt-2">
            6 Specialized Layers of Protection
          </h2>
          <p className="text-sm text-slate-400 mt-2 max-w-xl mx-auto">
            Engineered to operate continuously without optical blindness or cloud latency.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 transition duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 flex items-center justify-center text-cyan-400 border border-cyan-800 group-hover:scale-110 transition">
              <Eye className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mt-4 font-mono">1. Edge YOLO Vision</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Ultralytics YOLO11n + ByteTrack assigns anonymous IDs across frames at 17ms latency on your local RTX 3050 GPU. No human identity stored.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/50 transition duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-blue-950 flex items-center justify-center text-blue-400 border border-blue-800 group-hover:scale-110 transition">
              <Radio className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mt-4 font-mono">2. 24GHz mmWave Radar</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              FMCW radar micro-Doppler measures crowd chest velocity through dense crowds, smoke, fog, and total festival darkness without optical blindness.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 transition duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 flex items-center justify-center text-emerald-400 border border-emerald-800 group-hover:scale-110 transition">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mt-4 font-mono">3. Physical Servo Gate</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              SG90 physical barrier meters inflow automatically: 90° for free passage, 45° for caution metering, and 0° for emergency lockdown to break shockwaves.
            </p>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 transition duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-amber-950 flex items-center justify-center text-amber-400 border border-amber-800 group-hover:scale-110 transition">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mt-4 font-mono">4. Failover Watchdog</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              4.5-second heartbeat watchdog. If the camera or laptop cable is kicked, ESP32 Master autonomously switches to on-chip radar and ToF sensors.
            </p>
          </div>

          {/* Card 5 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-fuchsia-500/50 transition duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-fuchsia-950 flex items-center justify-center text-fuchsia-400 border border-fuchsia-800 group-hover:scale-110 transition">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mt-4 font-mono">5. Master Remote Control</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Dedicated mobile controller lets you walk around the exhibition and command Gate A, Gate B, density sliders, and emergency overrides from your phone.
            </p>
          </div>

          {/* Card 6 */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-purple-500/50 transition duration-300 group">
            <div className="w-10 h-10 rounded-xl bg-purple-950 flex items-center justify-center text-purple-400 border border-purple-800 group-hover:scale-110 transition">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white mt-4 font-mono">6. Cloud Anti-Sleep Engine</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Automated 10-minute self-ping heartbeat keeps your Render backend awake 24/7 without cold-start delays when judges open your Vercel link.
            </p>
          </div>

        </div>
      </section>

      {/* 5. Bottom Call to Action */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-10 px-4 text-center mt-auto">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-mono text-xs font-bold text-slate-300">
              DEPLOYED: VERCEL (FRONTEND) + RENDER (BACKEND)
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
            <button
              onClick={onEnterDashboard}
              className="px-6 py-2.5 rounded-xl font-mono text-xs font-bold bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/20 transition"
            >
              Enter Main Dashboard
            </button>
            <button
              onClick={onOpenMaster}
              className="px-6 py-2.5 rounded-xl font-mono text-xs font-bold bg-slate-900 hover:bg-slate-800 text-fuchsia-300 border border-fuchsia-700/60 transition"
            >
              Open Mobile Master Controller
            </button>
            <button
              onClick={onOpenSetup}
              className="px-6 py-2.5 rounded-xl font-mono text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition"
            >
              Gate Setup & Passcode
            </button>
          </div>

          <p className="text-[11px] font-mono text-slate-500 mt-4">
            Crowd Pressure Radar (CPR) Prototype • Built for Odisha AI Hackathon / Tech Exhibition Demonstration
          </p>
        </div>
      </footer>

    </div>
  );
};
