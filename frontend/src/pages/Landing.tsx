import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Radio,
  Ruler,
  Eye,
  Cpu,
  CheckCircle2,
  Menu,
  X,
  ArrowRight,
  Mail,
  Lock,
  Activity,
  Pause,
  Play,
  Zap,
  Server
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

const INITIAL_SERIES = [
  { t: '10:00', pressure: 24, count: 12 },
  { t: '10:02', pressure: 31, count: 16 },
  { t: '10:04', pressure: 28, count: 14 },
  { t: '10:06', pressure: 42, count: 21 },
  { t: '10:08', pressure: 38, count: 19 },
  { t: '10:10', pressure: 35, count: 17 }
];

export const Landing: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Real-time preview state (respects prefers-reduced-motion & user pause)
  const [previewPaused, setPreviewPaused] = useState(false);
  const [series, setSeries] = useState(INITIAL_SERIES);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (previewPaused || prefersReduced) return;

    const timer = setInterval(() => {
      setSeries((prev) => {
        const last = prev[prev.length - 1];
        const nextPressure = Math.max(18, Math.min(68, last.pressure + Math.round((Math.random() - 0.48) * 10)));
        const nextCount = Math.max(8, Math.round(nextPressure * 0.52));
        const now = new Date();
        const label = now.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
        return [...prev.slice(1), { t: label, pressure: nextPressure, count: nextCount }];
      });
    }, 2500);

    return () => clearInterval(timer);
  }, [previewPaused]);

  const latestPoint = series[series.length - 1];
  const isBusy = latestPoint.pressure >= 45;

  // Pilot contact form state
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [email, setEmail] = useState('');
  const [formErrors, setFormErrors] = useState<{ name?: string; organization?: string; email?: string }>({});
  const [submitted, setSubmitted] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; organization?: string; email?: string } = {};
    if (!name.trim()) errors.name = 'Please enter your name.';
    if (!organization.trim()) errors.organization = 'Please enter your organization.';
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Please enter a valid email address.';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const subject = encodeURIComponent(`CPR Pilot Request — ${organization.trim()}`);
    const body = encodeURIComponent(
      `Name: ${name.trim()}\nOrganization: ${organization.trim()}\nEmail: ${email.trim()}\n\nRequesting a pilot evaluation of Crowd Pressure Radar.`
    );
    window.location.href = `mailto:pilot@cpr-safety.org?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  const navLinks = [
    { href: '#features', label: 'Features' },
    { href: '#how-it-works', label: 'How it works' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#contact', label: 'Contact' }
  ];

  const trustBadges = [
    { label: 'Offline Edge Failover', detail: '1.5s local takeover', icon: Zap },
    { label: '24 GHz Radar + ToF', detail: 'Works in smoke & dark', icon: Radio },
    { label: '257ms Actuation', detail: 'ESP32 gate metering', icon: Cpu },
    { label: 'SOA University R&D', detail: 'Bhubaneswar, Odisha', icon: ShieldCheck }
  ];

  const features = [
    {
      title: 'Multi-Sensor Edge Fusion',
      description: 'Combines HLK-LD2410 millimeter-wave radar, VL53L0X laser ranging, and YOLO11n vision so blind spots never stall monitoring.',
      icon: Radio
    },
    {
      title: 'Real-Time Crowd Pressure Index',
      description: 'Tracks density, walking speed drops, and directional turbulence rather than raw headcount alone.',
      icon: Activity
    },
    {
      title: 'Automated Gate Metering',
      description: 'ESP32 drives servo or drop-arm barriers (90° open, 45° metered, 0° locked) to smooth queue surges before compression.',
      icon: Cpu
    },
    {
      title: 'Optical Failure Watchdog',
      description: 'Detects lens blur, darkness, or camera disconnect and switches to autonomous radar metering without dropping protection.',
      icon: Eye
    },
    {
      title: 'Millimeter Queue Ranging',
      description: 'Measures front-of-queue distance directly at the barricade to confirm physical pressure against the gate.',
      icon: Ruler
    },
    {
      title: 'Hardened Operator Controls',
      description: 'Role-protected dashboard, bcrypt + JWT authentication, rate-limited APIs, and PDF safety summary exports.',
      icon: Lock
    }
  ];

  const steps = [
    {
      num: '01',
      title: 'Sense presence',
      text: 'HLK-LD2410 24 GHz radar profiles moving and stationary people across 8 distance gates through smoke and low light.',
      icon: Radio
    },
    {
      num: '02',
      title: 'Measure the queue',
      text: 'VL53L0X laser ranging measures front-of-queue proximity to confirm physical compression at the gate.',
      icon: Ruler
    },
    {
      num: '03',
      title: 'Read pressure',
      text: 'Overhead webcam running YOLO11n computes planar density and speed, falling back to edge radar when obscured.',
      icon: Eye
    },
    {
      num: '04',
      title: 'Act at the gate',
      text: 'ESP32 adjusts barrier angles and streams status updates to the operations dashboard in real time.',
      icon: Cpu
    }
  ];

  const pricingTiers = [
    {
      name: 'Benchtop Pilot',
      price: '₹2,300',
      period: 'per prototype pod',
      description: 'Complete edge sensor kit for campus evaluations, lab testing, and single-gate demonstrations.',
      features: [
        'ESP32 + HLK-LD2410C + VL53L0X',
        'SG90 servo metering assembly',
        'Local dashboard & sandbox mode',
        'PDF incident summary export'
      ],
      highlighted: false,
      cta: 'Request pilot kit'
    },
    {
      name: 'Corridor Standard',
      price: '₹21,530',
      period: 'per gate + ₹1,999/mo SaaS',
      description: 'Production-ready corridor deployment for temple trusts, railway foot-overbridges, and transit hubs.',
      features: [
        'Industrial drop-arm fail-open barrier',
        'Dual-tier AI vision + radar failover',
        'Multi-gate live WebSocket dashboard',
        'JWT operator access & audit logs'
      ],
      highlighted: true,
      cta: 'Deploy corridor'
    },
    {
      name: 'District / Enterprise',
      price: 'Custom',
      period: 'annual municipal SLA',
      description: 'Multi-zone command center integration for major festivals, stadiums, and disaster management authorities.',
      features: [
        'Unlimited gates & zone homography',
        'Dedicated cloud or on-prem deployment',
        '24/7 telemetry & priority support',
        'Custom NDMA compliance reporting'
      ],
      highlighted: false,
      cta: 'Contact engineering'
    }
  ];

  return (
    <div className="min-h-dvh bg-[#0F172A] text-slate-50 flex flex-col safe-area-shell">
      {/* Sticky Glassmorphic Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0F172A]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[64px] flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-sm sm:text-base font-semibold tracking-tight text-white min-h-[44px] px-1 rounded cursor-pointer"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-400">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </span>
            <span>CPR Analytics</span>
          </Link>

          <nav aria-label="Primary" className="hidden lg:flex items-center gap-6">
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-slate-300 hover:text-white py-2 px-1 rounded transition-colors cursor-pointer"
              >
                {item.label}
              </a>
            ))}
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold transition-colors cursor-pointer"
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              <span>Operator login</span>
            </Link>
          </nav>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-white/15 bg-slate-800/70 text-white cursor-pointer"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="lg:hidden border-t border-white/10 bg-[#0F172A]/95 backdrop-blur-md px-4 py-3 flex flex-col gap-1"
          >
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] flex items-center px-3 rounded-lg text-sm font-medium text-slate-200 hover:bg-white/5"
              >
                {item.label}
              </a>
            ))}
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 min-h-[44px] flex items-center justify-center gap-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold"
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              <span>Operator login</span>
            </Link>
          </nav>
        )}
      </header>

      <main className="flex-1">
        {/* Hero Section with Real-Time Data Visualization Glass Card */}
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/15 text-xs font-medium text-emerald-400">
                <Server className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Real-time crowd telemetry & gate control</span>
              </div>

              <h1 className="text-3xl sm:text-4xl xl:text-5xl font-bold tracking-tight text-white leading-tight">
                Prevent crowd crush before chokepoints stall.
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                Crowd Pressure Radar fuses 24 GHz radar, laser ranging, and edge computer vision into one clear operations dashboard—metering gate inflow automatically even without internet.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <a
                  href="#contact"
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold transition-colors cursor-pointer"
                >
                  <span>Request a pilot</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg border border-white/15 bg-white/5 backdrop-blur-md hover:bg-white/10 text-white text-sm font-semibold transition-colors cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                  <span>Operator login</span>
                </Link>
              </div>
            </div>

            {/* Real-Time Data Visualization Glassmorphism Card */}
            <div className="lg:col-span-6">
              <div className="rounded-xl bg-slate-900/65 backdrop-blur-md border border-white/15 p-5 sm:p-6 shadow-xl space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                  <div>
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">
                      Sample Telemetry Stream • Gate A
                    </span>
                    <span className="text-base font-semibold text-white">
                      Corridor Pressure & Flow
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${
                        isBusy
                          ? 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                          : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isBusy ? 'Busy' : 'Clear'}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => setPreviewPaused((p) => !p)}
                      aria-label={previewPaused ? 'Resume live preview' : 'Pause live preview'}
                      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 transition-colors cursor-pointer"
                    >
                      {previewPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Live KPI Strip */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-slate-950/60 border border-white/10 p-3">
                    <span className="text-xs text-slate-400 block">People</span>
                    <span className="text-2xl font-bold text-white tabular-nums mt-0.5 block">
                      {latestPoint.count}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-950/60 border border-white/10 p-3">
                    <span className="text-xs text-slate-400 block">Pressure</span>
                    <span className="text-2xl font-bold text-emerald-400 tabular-nums mt-0.5 block">
                      {latestPoint.pressure}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-950/60 border border-white/10 p-3">
                    <span className="text-xs text-slate-400 block">Gate Angle</span>
                    <span className="text-2xl font-bold text-white tabular-nums mt-0.5 block">
                      {isBusy ? '45°' : '90°'}
                    </span>
                  </div>
                </div>

                {/* Recharts Real-Time Area Chart */}
                <div className="h-44 w-full rounded-lg bg-slate-950/50 border border-white/10 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="t" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} domain={[0, 80]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: 'rgba(255,255,255,0.15)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          color: '#f8fafc'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="pressure"
                        name="Pressure Score"
                        stroke="#22c55e"
                        fill="#22c55e"
                        fillOpacity={0.18}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Badges Strip */}
        <section aria-label="System trust indicators" className="border-b border-white/10 bg-slate-900/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trustBadges.map((badge) => {
              const Icon = badge.icon;
              return (
                <div
                  key={badge.label}
                  className="rounded-lg bg-white/5 border border-white/10 p-4 flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{badge.label}</div>
                    <div className="text-xs text-slate-400">{badge.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Feature Highlights with Icons (Glassmorphism Cards) */}
        <section id="features" className="border-b border-white/10 py-14 sm:py-18">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Engineered for reliability at physical chokepoints
              </h2>
              <p className="mt-2 text-base text-slate-300">
                Every subsystem is built to keep monitoring and metering gates when visibility or connectivity degrades.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feat) => {
                const Icon = feat.icon;
                return (
                  <article
                    key={feat.title}
                    className="rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/15 p-6 space-y-3 hover:border-emerald-400/40 transition-colors"
                  >
                    <div className="h-10 w-10 rounded-lg bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{feat.title}</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">{feat.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="border-b border-white/10 py-14 sm:py-18 bg-slate-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                How it works
              </h2>
              <p className="mt-2 text-base text-slate-300">
                Four stages from local sensing to physical gate metering.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.num}
                    className="rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/15 p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-400">STEP {step.num}</span>
                      <Icon className="w-5 h-5 text-emerald-400" aria-hidden="true" />
                    </div>
                    <h3 className="text-base font-semibold text-white">{step.title}</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">{step.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Pricing Table */}
        <section id="pricing" className="border-b border-white/10 py-14 sm:py-18">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Transparent deployment pricing
              </h2>
              <p className="mt-2 text-base text-slate-300">
                Start with a single benchtop pilot pod or scale across full temple and transit corridors.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {pricingTiers.map((tier) => (
                <div
                  key={tier.name}
                  className={`rounded-xl backdrop-blur-md p-6 flex flex-col justify-between space-y-6 ${
                    tier.highlighted
                      ? 'bg-slate-800/70 border-2 border-emerald-500/70 shadow-xl'
                      : 'bg-slate-900/60 border border-white/15'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">{tier.name}</h3>
                      {tier.highlighted && (
                        <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-semibold">
                          Recommended
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-3xl font-bold text-white">{tier.price}</span>
                      <span className="text-xs text-slate-400 block mt-1">{tier.period}</span>
                    </div>

                    <p className="text-sm text-slate-300 leading-relaxed">{tier.description}</p>

                    <ul className="space-y-2.5 pt-2 border-t border-white/10">
                      {tier.features.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-slate-200">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <a
                    href="#contact"
                    className={`min-h-[44px] inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                      tier.highlighted
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                        : 'bg-white/5 hover:bg-white/10 border border-white/15 text-white'
                    }`}
                  >
                    {tier.cta}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pilot Contact Section */}
        <section id="contact" className="py-14 sm:py-18">
          <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Request a pilot
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                Share your venue details to schedule a benchtop or corridor evaluation.
              </p>
            </div>

            <form
              onSubmit={handleContactSubmit}
              noValidate
              className="rounded-xl bg-slate-900/60 backdrop-blur-md border border-white/15 p-6 space-y-4"
            >
              <div>
                <label htmlFor="pilot-name" className="block text-sm font-medium text-slate-200 mb-1">
                  Name
                </label>
                <input
                  id="pilot-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-sm rounded-lg bg-slate-950/80 border border-white/15 text-white focus:outline-none focus:border-emerald-400"
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-rose-400">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="pilot-org" className="block text-sm font-medium text-slate-200 mb-1">
                  Organization
                </label>
                <input
                  id="pilot-org"
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-sm rounded-lg bg-slate-950/80 border border-white/15 text-white focus:outline-none focus:border-emerald-400"
                />
                {formErrors.organization && (
                  <p className="mt-1 text-xs text-rose-400">{formErrors.organization}</p>
                )}
              </div>

              <div>
                <label htmlFor="pilot-email" className="block text-sm font-medium text-slate-200 mb-1">
                  Email
                </label>
                <input
                  id="pilot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-sm rounded-lg bg-slate-950/80 border border-white/15 text-white focus:outline-none focus:border-emerald-400"
                />
                {formErrors.email && (
                  <p className="mt-1 text-xs text-rose-400">{formErrors.email}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold transition-colors cursor-pointer"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                <span>Send pilot request</span>
              </button>

              {submitted && (
                <p className="text-xs text-emerald-400 font-medium">
                  Your email client has been opened with the pilot request details.
                </p>
              )}
            </form>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-900/60 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <span>CPR (Crowd Pressure Radar) • Built at SOA University, Bhubaneswar</span>
          <span>Contact: pilot@cpr-safety.org • Prototype for demonstration and learning</span>
        </div>
      </footer>
    </div>
  );
};
