import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSessionToken } from '../lib/api';
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
  Zap
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
import {
  BlurText,
  ShinyText,
  CountUp,
  SpotlightCard,
  StarBorder,
  ClickSpark,
  RadarBackdrop
} from '../components/reactbits';

const INITIAL_SERIES = [
  { t: '10:00', pressure: 24, count: 12 },
  { t: '10:02', pressure: 31, count: 16 },
  { t: '10:04', pressure: 28, count: 14 },
  { t: '10:06', pressure: 42, count: 21 },
  { t: '10:08', pressure: 38, count: 19 },
  { t: '10:10', pressure: 35, count: 17 }
];

/* Flowing Mint/Emerald Curved Wave Lines (Mintlify-style) */
const EmeraldWaveMesh: React.FC<{ className?: string; idPrefix?: string }> = ({
  className = '',
  idPrefix = 'mintWave'
}) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 1440 520"
    fill="none"
    preserveAspectRatio="none"
    className={`pointer-events-none select-none ${className}`}
  >
    <defs>
      <linearGradient id={`${idPrefix}-grad-a`} x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#18e299" stopOpacity="0" />
        <stop offset="35%" stopColor="#18e299" stopOpacity="0.45" />
        <stop offset="70%" stopColor="#10b981" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#0d9373" stopOpacity="0" />
      </linearGradient>
      <linearGradient id={`${idPrefix}-grad-b`} x1="0%" y1="80%" x2="100%" y2="10%">
        <stop offset="0%" stopColor="#0d9373" stopOpacity="0" />
        <stop offset="50%" stopColor="#34d399" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#18e299" stopOpacity="0" />
      </linearGradient>
    </defs>
    {Array.from({ length: 14 }).map((_, idx) => {
      const offset = idx * 14;
      const yStart = 490 - offset * 0.75;
      const c1y = 330 + offset * 0.4;
      const c2y = 140 - offset * 0.5;
      const yEnd = 20 + offset * 0.65;
      return (
        <path
          key={idx}
          d={`M -80 ${yStart} C 360 ${c1y}, 920 ${c2y}, 1520 ${yEnd}`}
          stroke={`url(#${idx % 2 === 0 ? `${idPrefix}-grad-a` : `${idPrefix}-grad-b`})`}
          strokeWidth={idx % 3 === 0 ? '1.35' : '0.85'}
        />
      );
    })}
  </svg>
);

export const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isLoggedIn = Boolean(getSessionToken());

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
    { href: '#', label: 'Home' },
    { href: '#features', label: 'Platform' },
    { href: '#how-it-works', label: 'Architecture' },
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
    <ClickSpark sparkColor="#18e299" className="min-h-dvh bg-[#08090a] text-neutral-100 flex flex-col safe-area-shell selection:bg-[#18e299]/25 selection:text-white">
      {/* Sticky Minimal Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#08090a]/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-[60px] flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-white min-h-[44px] px-1 rounded"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#18e299]/15 border border-[#18e299]/35 text-[#18e299]">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            </span>
            <span>CPR</span>
          </Link>

          <nav aria-label="Primary" className="hidden lg:flex items-center gap-7">
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[13px] font-medium text-neutral-400 hover:text-white py-2 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-2.5">
            {isLoggedIn ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center justify-center min-h-[36px] px-4 py-1.5 rounded-full bg-[#18e299] hover:bg-[#10d484] text-[#08090a] text-[13px] font-semibold transition-colors"
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center min-h-[36px] px-3.5 py-1.5 rounded-full text-[13px] font-medium text-neutral-300 hover:text-white transition-colors"
                >
                  Sign in
                </Link>
                <a
                  href="#contact"
                  className="inline-flex items-center justify-center min-h-[36px] px-4 py-1.5 rounded-full bg-white hover:bg-neutral-200 text-[#08090a] text-[13px] font-semibold transition-colors"
                >
                  Request pilot
                </a>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg border border-white/[0.1] bg-white/[0.04] text-white"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="lg:hidden border-t border-white/[0.08] bg-[#08090a]/95 backdrop-blur-md px-4 py-3 flex flex-col gap-1"
          >
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] flex items-center px-3 rounded-lg text-sm font-medium text-neutral-300 hover:bg-white/[0.05] hover:text-white"
              >
                {item.label}
              </a>
            ))}
            {isLoggedIn ? (
              <button
                onClick={() => { setMobileMenuOpen(false); navigate('/dashboard'); }}
                className="mt-2 min-h-[44px] flex items-center justify-center gap-2 px-4 rounded-full bg-[#18e299] hover:bg-[#10d484] text-[#08090a] text-sm font-semibold"
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>Go to Dashboard</span>
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 min-h-[44px] flex items-center justify-center gap-2 px-4 rounded-full bg-white hover:bg-neutral-200 text-[#08090a] text-sm font-semibold"
              >
                <Lock className="w-4 h-4" aria-hidden="true" />
                <span>Operator login</span>
              </Link>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1">
        {/* Hero Section with Flowing Emerald Wave Mesh */}
        <section className="relative overflow-hidden border-b border-white/[0.08]">
          {/* Subtle top radial emerald ambience + diagonal flowing wave lines */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[420px] rounded-full bg-[#18e299]/[0.07] blur-[110px]"
          />
          <EmeraldWaveMesh
            idPrefix="heroWave"
            className="absolute inset-0 w-full h-full opacity-80"
          />
          <RadarBackdrop className="absolute -right-28 -top-12 opacity-40 hidden md:flex" />

          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-16 sm:pt-20 sm:pb-24">
            <div className="max-w-2xl space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.1] text-xs font-medium text-neutral-300">
                <span className="h-1.5 w-1.5 rounded-full bg-[#18e299]" aria-hidden="true" />
                <ShinyText text="Autonomous crowd safety telemetry" speedSec={4.5} />
              </div>

              <BlurText
                as="h1"
                text="Crowd crush prevention infrastructure."
                delay={30}
                stepDelay={55}
                className="text-4xl sm:text-5xl lg:text-[56px] font-semibold tracking-[-0.025em] text-white leading-[1.08]"
              />

              <p className="text-base sm:text-lg text-neutral-400 leading-relaxed max-w-xl">
                Crowd Pressure Radar fuses 24 GHz radar, laser ranging, and edge computer vision into one operations platform—metering gate inflow automatically even without internet.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <StarBorder
                  as="a"
                  href="#contact"
                  color="#18e299"
                  trailColor="#10b981"
                  stars={2}
                  sparkle
                  radius={999}
                  duration={3.8}
                  thickness={1.5}
                  backgroundColor="#ffffff"
                  textColor="#08090a"
                  className="min-h-[44px] px-5 py-2 text-sm font-semibold hover:bg-neutral-200 transition-colors"
                >
                  <span>Request a pilot</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </StarBorder>
                <StarBorder
                  as={isLoggedIn ? 'button' : Link}
                  {...(isLoggedIn ? { onClick: () => navigate('/dashboard') } : { to: '/login' })}
                  color="#18e299"
                  trailColor="#0d9373"
                  stars={1}
                  radius={999}
                  duration={5}
                  thickness={1}
                  backgroundColor="rgba(255,255,255,0.04)"
                  textColor="#ffffff"
                  borderColor="rgba(255,255,255,0.14)"
                  className="min-h-[44px] px-5 py-2 text-sm font-medium hover:bg-white/[0.08] transition-colors"
                >
                  {isLoggedIn ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5 text-[#18e299]" aria-hidden="true" />
                      <span>Go to Dashboard</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-[#18e299]" aria-hidden="true" />
                      <span>Operator login</span>
                    </>
                  )}
                </StarBorder>
              </div>
            </div>

            {/* Mintlify-style Framed Dark Glass Dashboard Preview */}
            <div className="mt-12 rounded-2xl border border-white/[0.1] bg-[#0d0f11]/90 backdrop-blur-xl overflow-hidden shadow-[0_24px_80px_-20px_rgba(0,0,0,0.85)]">
              {/* Top Window Bar */}
              <div className="px-4 sm:px-6 py-3 border-b border-white/[0.08] bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  </div>
                  <span className="text-xs font-medium text-neutral-400">
                    Sample Telemetry Stream • Gate A
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${
                      isBusy
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                        : 'bg-[#18e299]/10 border-[#18e299]/30 text-[#18e299]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isBusy ? 'Busy' : 'Clear'}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setPreviewPaused((p) => !p)}
                    aria-label={previewPaused ? 'Resume live preview' : 'Pause live preview'}
                    className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300 transition-colors"
                  >
                    {previewPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <SpotlightCard className="rounded-xl bg-white/[0.02] border border-white/[0.07] p-4">
                    <span className="text-xs text-neutral-500 block">People detected</span>
                    <span className="text-2xl font-semibold text-white tabular-nums mt-1 block">
                      <CountUp to={latestPoint.count} />
                    </span>
                  </SpotlightCard>
                  <SpotlightCard className="rounded-xl bg-white/[0.02] border border-white/[0.07] p-4">
                    <span className="text-xs text-neutral-500 block">Pressure score</span>
                    <span className="text-2xl font-semibold text-[#18e299] tabular-nums mt-1 block">
                      <CountUp to={latestPoint.pressure} />
                    </span>
                  </SpotlightCard>
                  <SpotlightCard className="rounded-xl bg-white/[0.02] border border-white/[0.07] p-4">
                    <span className="text-xs text-neutral-500 block">Barrier angle</span>
                    <span className="text-2xl font-semibold text-white tabular-nums mt-1 block">
                      {isBusy ? '45°' : '90°'}
                    </span>
                  </SpotlightCard>
                </div>

                <div className="h-52 w-full rounded-xl bg-[#08090a]/70 border border-white/[0.07] p-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="mintlifyAreaFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#18e299" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#18e299" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="t" stroke="#737373" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#737373" fontSize={11} tickLine={false} axisLine={false} domain={[0, 80]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0d0f11',
                          borderColor: 'rgba(255,255,255,0.12)',
                          borderRadius: '10px',
                          fontSize: '12px',
                          color: '#fafafa'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="pressure"
                        name="Pressure Score"
                        stroke="#18e299"
                        fill="url(#mintlifyAreaFill)"
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

        {/* Hairline Trust Grid (Mintlify-style divided grid) */}
        <section aria-label="System trust indicators" className="border-b border-white/[0.08]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-4 space-y-2">
              <p className="text-sm text-neutral-400 leading-relaxed">
                Built for high-density corridors, temple queues, and transit hubs where optical cameras alone fail.
              </p>
            </div>
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 border border-white/[0.08] rounded-xl overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-white/[0.08]">
              {trustBadges.map((badge, idx) => {
                const Icon = badge.icon;
                return (
                  <div
                    key={badge.label}
                    className={`p-5 bg-[#0b0c0e] flex items-center gap-3.5 ${
                      idx >= 2 ? 'sm:border-t sm:border-white/[0.08]' : ''
                    }`}
                  >
                    <div className="h-9 w-9 rounded-lg bg-[#18e299]/10 border border-[#18e299]/25 flex items-center justify-center text-[#18e299] shrink-0">
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{badge.label}</div>
                      <div className="text-xs text-neutral-500">{badge.detail}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Bento Feature Grid */}
        <section id="features" className="relative border-b border-white/[0.08] py-16 sm:py-24 overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="max-w-xl space-y-2">
                <h2 className="text-2xl sm:text-4xl font-semibold text-white tracking-[-0.02em]">
                  One platform for your entire corridor stack.
                </h2>
                <p className="text-sm sm:text-base text-neutral-400">
                  Every subsystem is built to keep monitoring and metering gates when visibility or connectivity degrades.
                </p>
              </div>
              <a
                href="#contact"
                className="inline-flex items-center justify-center min-h-[38px] px-4 py-1.5 rounded-full bg-white text-[#08090a] hover:bg-neutral-200 text-xs font-semibold transition-colors self-start sm:self-auto"
              >
                Request pilot
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border border-white/[0.08] rounded-2xl overflow-hidden bg-[#0b0c0e]">
              {features.map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <SpotlightCard
                    key={feat.title}
                    className={`p-6 sm:p-7 border-white/[0.08] ${
                      idx % 3 !== 2 ? 'lg:border-r' : ''
                    } ${idx < 3 ? 'lg:border-b' : ''} ${
                      idx % 2 === 0 ? 'md:border-r lg:border-r-0' : ''
                    } border-b md:border-b lg:last:border-b-0`}
                  >
                    <article className="space-y-3 h-full">
                      {idx === 0 && (
                        <EmeraldWaveMesh
                          idPrefix="bentoWave"
                          className="pointer-events-none absolute -inset-7 w-[calc(100%+3.5rem)] h-[calc(100%+3.5rem)] opacity-35"
                        />
                      )}
                      <div className="relative z-10 h-9 w-9 rounded-lg bg-[#18e299]/10 border border-[#18e299]/25 flex items-center justify-center text-[#18e299]">
                        <Icon className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <h3 className="relative z-10 text-base font-semibold text-white">{feat.title}</h3>
                      <p className="relative z-10 text-sm text-neutral-400 leading-relaxed">{feat.description}</p>
                    </article>
                  </SpotlightCard>
                );
              })}
            </div>
          </div>
        </section>

        {/* Architecture & Scale Metrics (Mintlify 4-step + metric strip) */}
        <section id="how-it-works" className="relative border-b border-white/[0.08] py-16 sm:py-24 overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
            <div className="max-w-xl space-y-2">
              <h2 className="text-2xl sm:text-4xl font-semibold text-white tracking-[-0.02em]">
                Built to respond in milliseconds.
              </h2>
              <p className="text-sm sm:text-base text-neutral-400">
                Four stages from local sensing to physical gate metering.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <SpotlightCard
                    key={step.num}
                    className="rounded-xl bg-[#0d0f11] border border-white/[0.08] p-5"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[#18e299]">STEP {step.num}</span>
                        <Icon className="w-4 h-4 text-[#18e299]" aria-hidden="true" />
                      </div>
                      <h3 className="text-base font-semibold text-white">{step.title}</h3>
                      <p className="text-sm text-neutral-400 leading-relaxed">{step.text}</p>
                    </div>
                  </SpotlightCard>
                );
              })}
            </div>

            {/* Minimal Metric Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 pt-8 border-t border-white/[0.08]">
              <div>
                <div className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">257 ms</div>
                <div className="text-xs text-neutral-500 mt-1">End-to-end physical barrier actuation</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">24 GHz</div>
                <div className="text-xs text-neutral-500 mt-1">FMCW radar penetrates smoke and darkness</div>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">99.99%</div>
                <div className="text-xs text-neutral-500 mt-1">Autonomous edge failover continuity</div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Table */}
        <section id="pricing" className="border-b border-white/[0.08] py-16 sm:py-24">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
            <div className="max-w-xl space-y-2">
              <h2 className="text-2xl sm:text-4xl font-semibold text-white tracking-[-0.02em]">
                Transparent deployment pricing.
              </h2>
              <p className="text-sm sm:text-base text-neutral-400">
                Start with a single benchtop pilot pod or scale across full temple and transit corridors.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {pricingTiers.map((tier) => (
                <div
                  key={tier.name}
                  className={`relative rounded-2xl p-6 flex flex-col justify-between space-y-6 overflow-hidden ${
                    tier.highlighted
                      ? 'bg-[#0d0f11] border border-[#18e299]/50'
                      : 'bg-[#0b0c0e] border border-white/[0.08]'
                  }`}
                >
                  {tier.highlighted && (
                    <EmeraldWaveMesh
                      idPrefix="pricingWave"
                      className="absolute inset-0 w-full h-full opacity-25"
                    />
                  )}
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-white">{tier.name}</h3>
                      {tier.highlighted && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#18e299]/15 border border-[#18e299]/35 text-[#18e299] text-xs font-medium">
                          Recommended
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-3xl font-semibold text-white">{tier.price}</span>
                      <span className="text-xs text-neutral-500 block mt-1">{tier.period}</span>
                    </div>

                    <p className="text-sm text-neutral-400 leading-relaxed">{tier.description}</p>

                    <ul className="space-y-2.5 pt-3 border-t border-white/[0.08]">
                      {tier.features.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-neutral-300">
                          <CheckCircle2 className="w-4 h-4 text-[#18e299] shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <a
                    href="#contact"
                    className={`relative z-10 min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                      tier.highlighted
                        ? 'bg-white hover:bg-neutral-200 text-[#08090a]'
                        : 'bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white'
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
        <section id="contact" className="relative py-16 sm:py-24 overflow-hidden">
          <div className="max-w-xl mx-auto px-4 sm:px-6 space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-[-0.02em]">
                Request a pilot
              </h2>
              <p className="text-sm text-neutral-400">
                Share your venue details to schedule a benchtop or corridor evaluation.
              </p>
            </div>

            <form
              onSubmit={handleContactSubmit}
              noValidate
              className="rounded-2xl bg-[#0d0f11] border border-white/[0.08] p-6 space-y-4"
            >
              <div>
                <label htmlFor="pilot-name" className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Name
                </label>
                <input
                  id="pilot-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-lg bg-[#08090a] border border-white/[0.12] text-white focus:outline-none focus:border-[#18e299]"
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-rose-400">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="pilot-org" className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Organization
                </label>
                <input
                  id="pilot-org"
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-lg bg-[#08090a] border border-white/[0.12] text-white focus:outline-none focus:border-[#18e299]"
                />
                {formErrors.organization && (
                  <p className="mt-1 text-xs text-rose-400">{formErrors.organization}</p>
                )}
              </div>

              <div>
                <label htmlFor="pilot-email" className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Email
                </label>
                <input
                  id="pilot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm rounded-lg bg-[#08090a] border border-white/[0.12] text-white focus:outline-none focus:border-[#18e299]"
                />
                {formErrors.email && (
                  <p className="mt-1 text-xs text-rose-400">{formErrors.email}</p>
                )}
              </div>

              <StarBorder
                as="button"
                type="submit"
                color="#18e299"
                trailColor="#10b981"
                stars={2}
                sparkle
                radius={999}
                duration={4}
                thickness={1.5}
                backgroundColor="#ffffff"
                textColor="#08090a"
                className="w-full min-h-[44px] px-5 py-2.5 text-sm font-semibold hover:bg-neutral-200 transition-colors"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                <span>Send pilot request</span>
              </StarBorder>

              {submitted && (
                <p className="text-xs text-[#18e299] font-medium">
                  Your email client has been opened with the pilot request details.
                </p>
              )}
            </form>
          </div>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-white/[0.08] bg-[#08090a] py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
          <span>CPR (Crowd Pressure Radar) • Built at SOA University, Bhubaneswar</span>
          <span>Contact: pilot@cpr-safety.org • Prototype for demonstration and learning</span>
        </div>
      </footer>
    </ClickSpark>
  );
};
