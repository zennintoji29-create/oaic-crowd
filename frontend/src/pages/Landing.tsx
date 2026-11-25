import React, { useState } from 'react';
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
  Lock
} from 'lucide-react';

export const Landing: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    { href: '#solution', label: 'Solution' },
    { href: '#how-it-works', label: 'How it works' },
    { href: '#use-cases', label: 'Use cases' },
    { href: '#contact', label: 'Contact' }
  ];

  const steps = [
    {
      num: '01',
      title: 'Sense presence',
      text: 'The HLK-LD2410 24 GHz radar detects stationary and moving people across 8 distance gates through smoke, dust, and darkness.',
      icon: Radio
    },
    {
      num: '02',
      title: 'Measure the queue',
      text: 'The VL53L0X laser distance sensor measures how close the front of the queue is pressed against the gate barrier.',
      icon: Ruler
    },
    {
      num: '03',
      title: 'Read pressure',
      text: 'An overhead webcam running YOLO11n tracks crowd density and flow speed, falling back to edge radar if the lens is blocked or dark.',
      icon: Eye
    },
    {
      num: '04',
      title: 'Act at the gate',
      text: 'An ESP32 microcontroller drives SG90 servo barriers to meter inflow while updating the operations dashboard in real time.',
      icon: Cpu
    }
  ];

  const useCases = [
    {
      title: 'Temple corridors and pilgrimage',
      description:
        'Meters pedestrian inflow into narrow stone corridors where incense smoke, humidity, and heavy crowds reduce camera visibility.',
      example: 'Example: Puri Jagannath Temple Bada Danda and Rath Yatra barricade checkpoints.'
    },
    {
      title: 'Railway overbridges and metro',
      description:
        'Monitors foot-overbridges and stair landings for sudden slowdowns before backward pressure builds up behind commuters.',
      example: 'Example: Suburban rail foot-overbridge entry gates during peak evening departures.'
    },
    {
      title: 'Stadiums and rallies',
      description:
        'Keeps turnstiles operating autonomously when mobile networks saturate or floodlights flicker during mass egress.',
      example: 'Example: Stadium perimeter gates handling post-match exit surges.'
    }
  ];

  const hardwareSpecs = [
    {
      component: 'HLK-LD2410 radar',
      spec: '24 GHz FMCW, 8 gates (up to 6 m)',
      role: 'Detects human presence and stationary queue dwell through smoke, dust, and low light.'
    },
    {
      component: 'VL53L0X distance sensor',
      spec: '940 nm laser Time-of-Flight, I2C',
      role: 'Measures front-of-queue distance to confirm physical compression at the gate.'
    },
    {
      component: 'ESP32',
      spec: 'Dual-core 240 MHz microcontroller',
      role: 'Runs the local safety state machine and controls gate actuators even if Wi-Fi drops.'
    },
    {
      component: 'SG90 servos',
      spec: 'PWM barrier arm (90° open, 45° meter, 0° locked)',
      role: 'Demonstrates physical inflow metering and emergency gate closure on the benchtop.'
    },
    {
      component: 'Webcam with YOLO11n',
      spec: 'Edge USB camera + planar homography',
      role: 'Computes real-time people count, density, and walking speed when visibility is clear.'
    }
  ];

  const faqs = [
    {
      q: 'What does it detect?',
      a: 'It measures crowd density, walking speed slowdown, and stationary queue buildup at chokepoints before people are compressed against barriers.'
    },
    {
      q: 'Does it need internet?',
      a: 'No. The ESP32 node evaluates local radar and distance sensors on-device and continues metering gates even if the internet or central server goes offline.'
    },
    {
      q: 'Is it certified?',
      a: 'No. This is an engineering prototype built for demonstration, testing, and research evaluation, not a certified life-safety product.'
    },
    {
      q: 'How is it installed?',
      a: 'The sensor pod mounts at chest height on an existing queue barricade or turnstile stanchion, paired with an overhead camera overlooking the entry zone.'
    }
  ];

  return (
    <div className="min-h-dvh bg-surface-base text-text-primary flex flex-col safe-area-shell">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-border-subtle bg-surface-raised">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[64px] flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-sm sm:text-base font-semibold tracking-tight text-text-primary min-h-[44px] px-1 rounded"
          >
            <ShieldCheck className="w-5 h-5 text-accent shrink-0" aria-hidden="true" />
            <span>CPR Crowd Pressure Radar</span>
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Primary" className="hidden lg:flex items-center gap-6">
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-text-secondary hover:text-text-primary py-2 px-1 rounded transition-colors"
              >
                {item.label}
              </a>
            ))}
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 rounded-md bg-accent hover:bg-accent-hover text-slate-950 text-sm font-semibold transition-colors"
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              <span>Operator login</span>
            </Link>
          </nav>

          {/* Mobile / Tablet Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-md border border-border-strong bg-surface-sunken text-text-primary"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile / Tablet Dropdown Menu */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="lg:hidden border-t border-border-subtle bg-surface-raised px-4 py-3 flex flex-col gap-1"
          >
            {navLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] flex items-center px-3 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-sunken"
              >
                {item.label}
              </a>
            ))}
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 min-h-[44px] flex items-center justify-center gap-2 px-4 rounded-md bg-accent hover:bg-accent-hover text-slate-950 text-sm font-semibold"
            >
              <Lock className="w-4 h-4" aria-hidden="true" />
              <span>Operator login</span>
            </Link>
          </nav>
        )}
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="border-b border-border-subtle">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-5">
              <h1 className="text-3xl sm:text-4xl xl:text-5xl font-bold tracking-tight text-text-primary leading-tight">
                Automated gate metering and crowd crush warning for high-density venues.
              </h1>
              <p className="text-base sm:text-lg text-text-secondary leading-relaxed max-w-xl">
                CPR combines 24 GHz millimeter-wave radar, laser distance ranging, and edge computer vision to detect dangerous queue buildup and regulate gate inflow even when cameras or mobile networks fail.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href="#contact"
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-md bg-accent hover:bg-accent-hover text-slate-950 text-sm font-semibold transition-colors"
                >
                  <span>Request a pilot</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-md border border-border-strong bg-surface-raised hover:bg-surface-sunken text-text-primary text-sm font-semibold transition-colors"
                >
                  <Lock className="w-4 h-4 text-accent" aria-hidden="true" />
                  <span>Operator login</span>
                </Link>
              </div>
            </div>

            {/* Real HTML/CSS Dashboard Preview Card */}
            <div className="lg:col-span-6">
              <div className="flat-panel p-5 sm:p-6 space-y-5" aria-label="Sample gate monitoring card">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-subtle">
                  <div>
                    <span className="text-xs font-medium text-text-muted uppercase tracking-wider block">
                      Gate A — Main Entry Corridor
                    </span>
                    <span className="text-base font-semibold text-text-primary">
                      Live Chokepoint Status
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md border border-status-clear-border bg-status-clear-bg text-status-clear-text text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>Clear</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="flat-panel-sunken p-3">
                    <span className="text-xs text-text-muted block">People in zone</span>
                    <span className="text-2xl sm:text-3xl font-bold text-text-primary tabular-nums mt-0.5 block">
                      14
                    </span>
                  </div>
                  <div className="flat-panel-sunken p-3">
                    <span className="text-xs text-text-muted block">Barrier angle</span>
                    <span className="text-2xl sm:text-3xl font-bold text-text-primary tabular-nums mt-0.5 block">
                      90°
                    </span>
                  </div>
                  <div className="flat-panel-sunken p-3 col-span-2 sm:col-span-1">
                    <span className="text-xs text-text-muted block">Density</span>
                    <span className="text-2xl sm:text-3xl font-bold text-text-primary tabular-nums mt-0.5 block">
                      0.6 p/m²
                    </span>
                  </div>
                </div>

                {/* Simple Static Trend Line Built with SVG */}
                <div className="flat-panel-sunken p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-text-muted">
                    <span>10-minute pressure trend</span>
                    <span>Threshold: 75</span>
                  </div>
                  <svg viewBox="0 0 320 64" className="w-full h-16" role="img" aria-label="Crowd pressure line chart">
                    <line x1="0" y1="20" x2="320" y2="20" stroke="var(--status-danger-border)" strokeDasharray="4 4" strokeWidth="1" />
                    <polyline
                      fill="none"
                      stroke="var(--status-clear-chart)"
                      strokeWidth="2.5"
                      points="0,50 40,46 80,48 120,38 160,42 200,34 240,36 280,30 320,32"
                    />
                  </svg>
                </div>

                <p className="text-xs text-text-secondary">
                  Pedestrians are moving steadily through Gate A. No metering required.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Strip */}
        <section aria-label="Operational capabilities" className="border-b border-border-subtle bg-surface-raised">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm font-medium text-text-secondary">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
              <span>Works without mobile network</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
              <span>Operates in low light and smoke</span>
            </div>
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
              <span>Runs on ESP32 and standard webcam hardware</span>
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section id="solution" className="border-b border-border-subtle py-12 sm:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
              Why camera-only monitoring fails during crowd crush
            </h2>
            <p className="text-base text-text-secondary leading-relaxed">
              Fatal crowd incidents at temples, railway foot-overbridges, and stadiums are caused by compressive pressure when inflow continues after a corridor stalls. Standard CCTV cameras lose accuracy above 4 people per square meter, get blinded by incense smoke or dust, and cannot physically slow down the incoming queue. CPR measures both movement and physical queue pressure directly at the gate so inflow can be metered early.
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="border-b border-border-subtle py-12 sm:py-16 bg-surface-sunken">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                How it works
              </h2>
              <p className="mt-2 text-base text-text-secondary">
                Four stages from local sensing to automated gate actuation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.num} className="flat-panel p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-accent">STEP {step.num}</span>
                      <Icon className="w-5 h-5 text-accent" aria-hidden="true" />
                    </div>
                    <h3 className="text-base font-semibold text-text-primary">{step.title}</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">{step.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section id="use-cases" className="border-b border-border-subtle py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                Use cases
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {useCases.map((item) => (
                <article key={item.title} className="flat-panel p-6 space-y-3">
                  <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{item.description}</p>
                  <p className="text-xs font-medium text-text-muted pt-2 border-t border-border-subtle">
                    {item.example}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Hardware & Specs */}
        <section className="border-b border-border-subtle py-12 sm:py-16 bg-surface-sunken">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
              Hardware and specifications
            </h2>

            {/* Mobile Stacked Cards */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {hardwareSpecs.map((row) => (
                <div key={row.component} className="flat-panel p-4 space-y-1.5">
                  <div className="text-sm font-semibold text-text-primary">{row.component}</div>
                  <div className="text-xs font-medium text-accent">{row.spec}</div>
                  <p className="text-xs text-text-secondary">{row.role}</p>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block flat-panel overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-sunken border-b border-border-subtle text-xs font-semibold uppercase text-text-muted">
                  <tr>
                    <th className="py-3 px-4">Component</th>
                    <th className="py-3 px-4">Specification</th>
                    <th className="py-3 px-4">Role in CPR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {hardwareSpecs.map((row) => (
                    <tr key={row.component}>
                      <td className="py-3.5 px-4 font-semibold text-text-primary whitespace-nowrap">
                        {row.component}
                      </td>
                      <td className="py-3.5 px-4 text-text-secondary whitespace-nowrap">
                        {row.spec}
                      </td>
                      <td className="py-3.5 px-4 text-text-secondary">{row.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Pilot Contact Section */}
        <section id="contact" className="border-b border-border-subtle py-12 sm:py-16">
          <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                Request a pilot
              </h2>
              <p className="mt-2 text-sm text-text-secondary">
                Share your venue details to schedule a benchtop or corridor evaluation.
              </p>
            </div>

            <form onSubmit={handleContactSubmit} noValidate className="flat-panel p-6 space-y-4">
              <div>
                <label htmlFor="pilot-name" className="block text-sm font-medium text-text-primary mb-1">
                  Name
                </label>
                <input
                  id="pilot-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-sm rounded-md bg-surface-sunken border border-border-strong text-text-primary focus:outline-none focus:border-accent"
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-status-danger-text">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="pilot-org" className="block text-sm font-medium text-text-primary mb-1">
                  Organization
                </label>
                <input
                  id="pilot-org"
                  type="text"
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-sm rounded-md bg-surface-sunken border border-border-strong text-text-primary focus:outline-none focus:border-accent"
                />
                {formErrors.organization && (
                  <p className="mt-1 text-xs text-status-danger-text">{formErrors.organization}</p>
                )}
              </div>

              <div>
                <label htmlFor="pilot-email" className="block text-sm font-medium text-text-primary mb-1">
                  Email
                </label>
                <input
                  id="pilot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-sm rounded-md bg-surface-sunken border border-border-strong text-text-primary focus:outline-none focus:border-accent"
                />
                {formErrors.email && (
                  <p className="mt-1 text-xs text-status-danger-text">{formErrors.email}</p>
                )}
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-accent hover:bg-accent-hover text-slate-950 text-sm font-semibold transition-colors"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                <span>Send pilot request</span>
              </button>

              {submitted && (
                <p className="text-xs text-status-clear-text font-medium">
                  Your email client has been opened with the pilot request details.
                </p>
              )}
            </form>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12 sm:py-16 bg-surface-sunken">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
              Frequently asked questions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {faqs.map((item) => (
                <div key={item.q} className="flat-panel p-5 space-y-2">
                  <h3 className="text-base font-semibold text-text-primary">{item.q}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle bg-surface-raised py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
          <span>CPR (Crowd Pressure Radar) • Built at SOA University, Bhubaneswar</span>
          <span>Contact: pilot@cpr-safety.org • Prototype for demonstration and learning</span>
        </div>
      </footer>
    </div>
  );
};
