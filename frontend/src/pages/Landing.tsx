import React from 'react';
import { Link } from 'react-router-dom';
import {
  Radio,
  Ruler,
  Eye,
  Cpu,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export const Landing: React.FC = () => {
  const fitCards = [
    {
      title: 'Temple Trusts & Pilgrimage',
      description:
        'Meters dense sanctum queues through incense smoke and monsoon humidity without relying on optical visibility alone.',
      tags: ['Puri', 'Lingaraj', 'Rath Yatra']
    },
    {
      title: 'Railway Overbridges & Metro',
      description:
        'Detects stationary stall buildup on narrow foot-overbridges and stairways before backward shockwaves form.',
      tags: ['FOB Metering', 'Platform Stairs', 'Peak Rush']
    },
    {
      title: 'Stadiums & Rallies',
      description:
        'Operates autonomously at perimeter turnstiles even when cellular backhaul saturates or floodlights fail.',
      tags: ['Turnstiles', 'Zero Backhaul', 'Night Ops']
    }
  ];

  const steps = [
    {
      number: '01',
      title: 'Sense presence',
      detail:
        'HLK-LD2410 24 GHz FMCW millimeter-wave radar profiles stationary dwell and micro-movements across 8 distance gates, penetrating smoke, dust, and darkness.',
      icon: Radio
    },
    {
      number: '02',
      title: 'Measure the queue',
      detail:
        'VL53L0X 940 nm laser Time-of-Flight ranging measures front-of-queue proximity to the millimeter, confirming physical compression against the gate.',
      icon: Ruler
    },
    {
      number: '03',
      title: 'Read pressure',
      detail:
        'Overhead webcam running YOLO11n computes planar density and directional turbulence, with automatic sub-second fallback to edge radar when blurred or dark.',
      icon: Eye
    },
    {
      number: '04',
      title: 'Act',
      detail:
        'ESP32 drives SG90 servos (90° open, 45° metered inflow, 0° locked) while the live operations dashboard flags zone risk in real time.',
      icon: Cpu
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* Sticky Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <nav
          aria-label="Landing navigation"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4"
        >
          <Link
            to="/"
            className="flex items-center gap-2.5 text-sm sm:text-base font-bold tracking-tight text-white rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-400">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </span>
            <span>CPR Crowd Pressure Radar</span>
          </Link>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <span>Open dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono tracking-wide uppercase">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                Crowd safety where CCTV goes blind
              </p>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.12]">
                Detect crowd crush risk before it becomes a stampede.
              </h1>

              <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed">
                CPR fuses 24 GHz millimeter-wave radar, laser distance sensing, and edge computer vision to meter chokepoints automatically. It keeps operating through dense smoke, low light, and complete mobile network loss.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  <span>Open dashboard</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {/* Animated CSS Radar Visual */}
            <div className="lg:col-span-5 flex justify-center">
              <div
                className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-full border border-emerald-500/30 bg-slate-900/80 shadow-[0_0_60px_rgba(16,185,129,0.12)] flex items-center justify-center overflow-hidden"
                aria-hidden="true"
              >
                <div className="absolute w-56 h-56 rounded-full border border-emerald-500/20" />
                <div className="absolute w-36 h-36 rounded-full border border-emerald-500/20" />
                <div className="absolute w-16 h-16 rounded-full border border-emerald-500/30" />
                <div className="absolute inset-x-0 h-px bg-emerald-500/15" />
                <div className="absolute inset-y-0 w-px bg-emerald-500/15" />

                <div
                  className="absolute inset-0 rounded-full animate-radar-sweep"
                  style={{
                    background:
                      'conic-gradient(from 0deg, rgba(16, 185, 129, 0.32) 0deg, rgba(16, 185, 129, 0.08) 45deg, transparent 90deg, transparent 360deg)'
                  }}
                />

                <span className="absolute top-[26%] left-[62%] h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399] animate-radar-blip" />
                <span
                  className="absolute top-[58%] left-[30%] h-3.5 w-3.5 rounded-full bg-amber-400 shadow-[0_0_12px_#fbbf24] animate-radar-blip"
                  style={{ animationDelay: '0.7s' }}
                />
                <span
                  className="absolute top-[40%] left-[44%] h-2.5 w-2.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#6ee7b7] animate-radar-blip"
                  style={{ animationDelay: '1.3s' }}
                />

                <span className="relative z-10 h-3 w-3 rounded-full bg-emerald-400 ring-4 ring-emerald-500/20" />

                <div className="absolute bottom-4 inset-x-0 text-center font-mono text-[10px] tracking-widest uppercase text-emerald-400/80">
                  HLK-LD2410 • 24 GHz
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Where It Fits */}
        <section aria-labelledby="where-it-fits-heading" className="py-16 sm:py-20 border-b border-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-10">
              <h2 id="where-it-fits-heading" className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Where it fits
              </h2>
              <p className="mt-2 text-sm sm:text-base text-slate-400">
                Designed for high-density pedestrian bottlenecks where delayed intervention turns congestion into compressive asphyxia.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {fitCards.map((card) => (
                <article
                  key={card.title}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 flex flex-col justify-between hover:border-emerald-500/40 transition-colors"
                >
                  <div>
                    <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                    <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">{card.description}</p>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-md text-xs font-mono bg-slate-950 border border-slate-800 text-emerald-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section aria-labelledby="how-it-works-heading" className="py-16 sm:py-20 border-b border-slate-900 bg-slate-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-10">
              <h2 id="how-it-works-heading" className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                How it works
              </h2>
              <p className="mt-2 text-sm sm:text-base text-slate-400">
                Four coordinated stages from multi-sensor perception to physical inflow metering.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.number}
                    className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 flex flex-col gap-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-emerald-400 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30">
                        STEP {step.number}
                      </span>
                      <Icon className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">{step.title}</h3>
                      <p className="mt-2 text-sm text-slate-400 leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Monitor live telemetry and smart gate status.
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
              Real-time crowd pressure monitoring, zone analytics, and autonomous gate metering.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              >
                <span>Open dashboard</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 font-mono">
        Built at SOA University, Bhubaneswar
      </footer>
    </div>
  );
};
