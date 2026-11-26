import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Radar,
  Cpu,
  Bell,
  Sliders,
  ShieldCheck,
  LogOut,
  MoreVertical,
  Menu,
  X,
  User
} from 'lucide-react';

export interface NavTabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  to?: string;
}

interface NavigationProps {
  activeTab: string;
  setActiveTab: (tabId: string) => void;
  alertCount: number;
  onLogout?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  alertCount,
  onLogout
}) => {
  const [navHidden, setNavHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const primaryItems: NavTabItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'detail', label: 'Zone Details', icon: Radar },
    { id: 'alerts', label: 'Alerts & History', icon: Bell, count: alertCount }
  ];

  const configItems: NavTabItem[] = [
    { id: 'setup', label: 'System Setup', icon: Sliders },
    // Hardware Demo placed last in configuration/tools
    { id: 'sandbox', label: 'Hardware Demo', icon: Cpu, to: '/sandbox' }
  ];

  return (
    <>
      {/* Desktop / Laptop Fixed Non-Scrollable Left Sidebar (lg+) */}
      {navHidden ? (
        /* Transparent 3-dots toggle taking zero layout space */
        <button
          type="button"
          onClick={() => setNavHidden(false)}
          className="hidden lg:inline-flex fixed top-[74px] left-2 z-40 min-h-[44px] min-w-[44px] items-center justify-center rounded-md bg-transparent hover:bg-white/10 text-text-secondary hover:text-text-primary transition-colors"
          title="Open navigation bar"
          aria-label="Open navigation bar"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      ) : (
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex flex-col w-60 shrink-0 border-r border-white/[0.08] bg-[#0a0c0e]/95 p-3 sticky top-[61px] h-[calc(100dvh-61px)] overflow-hidden justify-between"
        >
          <div className="flex flex-col gap-1">
            {/* Compact Status Header */}
            <div className="flex items-center justify-between px-2.5 py-2 mb-1.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#18e299]" aria-hidden="true" />
                <span className="text-xs font-semibold tracking-wide text-white">
                  Control Panel
                </span>
              </div>
              <button
                type="button"
                onClick={() => setNavHidden(true)}
                className="min-h-[32px] min-w-[32px] inline-flex items-center justify-center rounded-md bg-transparent hover:bg-white/10 text-text-muted hover:text-text-primary transition-colors"
                title="Hide navigation bar"
                aria-label="Hide navigation bar"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 px-2.5 pt-1 pb-0.5">
              Monitoring
            </span>

            {primaryItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-[44px] flex items-center justify-between px-2.5 py-2 text-sm font-medium rounded-lg transition-all text-left border-l-2 ${
                    isActive
                      ? 'bg-[#18e299]/10 text-[#18e299] border-[#18e299] font-semibold shadow-sm'
                      : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <span
                      className={`p-1.5 rounded-md ${
                        isActive ? 'bg-[#18e299]/15 text-[#18e299]' : 'bg-white/[0.03] text-neutral-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>

                  {typeof item.count === 'number' && item.count > 0 && (
                    <span className="text-xs px-1.5 py-0.5 border border-rose-500/30 rounded-full bg-rose-500/10 text-rose-300 tabular-nums">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Configuration & Demo Section */}
            <div className="pt-2 mt-1.5 border-t border-white/[0.07] flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 px-2.5 py-0.5">
                Configuration &amp; Demo
              </span>
              {configItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                if (item.to) {
                  return (
                    <Link
                      key={item.id}
                      to={item.to}
                      className={`min-h-[44px] flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium rounded-lg transition-all border-l-2 ${
                        isActive
                          ? 'bg-[#18e299]/10 text-[#18e299] border-[#18e299] font-semibold'
                          : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className={`p-1.5 rounded-md ${
                          isActive ? 'bg-[#18e299]/15 text-[#18e299]' : 'bg-white/[0.03] text-neutral-400'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      </span>
                      <span>{item.label}</span>
                    </Link>
                  );
                }
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`min-h-[44px] flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium rounded-lg transition-all text-left border-l-2 ${
                      isActive
                        ? 'bg-[#18e299]/10 text-[#18e299] border-[#18e299] font-semibold'
                        : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span
                      className={`p-1.5 rounded-md ${
                        isActive ? 'bg-[#18e299]/15 text-[#18e299]' : 'bg-white/[0.03] text-neutral-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    </span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* About & Safety placed below Configuration & Demo */}
            <div className="pt-2 mt-1.5 border-t border-white/[0.07] flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500 px-2.5 py-0.5">
                Documentation
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('about')}
                className={`w-full min-h-[44px] flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium rounded-lg transition-all text-left border-l-2 ${
                  activeTab === 'about'
                    ? 'bg-[#18e299]/10 text-[#18e299] border-[#18e299] font-semibold'
                    : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.04]'
                }`}
                aria-current={activeTab === 'about' ? 'page' : undefined}
              >
                <span
                  className={`p-1.5 rounded-md ${
                    activeTab === 'about' ? 'bg-[#18e299]/15 text-[#18e299]' : 'bg-white/[0.03] text-neutral-400'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                </span>
                <span>About &amp; Safety</span>
              </button>
            </div>
          </div>

          {/* Bottom Utility Action */}
          <div className="pt-2 border-t border-white/[0.07] flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`min-h-[44px] flex items-center gap-2.5 px-2.5 py-2 text-sm font-medium rounded-lg transition-all text-left border-l-2 ${
                activeTab === 'profile'
                  ? 'bg-[#18e299]/10 text-[#18e299] border-[#18e299] font-semibold'
                  : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
              aria-current={activeTab === 'profile' ? 'page' : undefined}
            >
              <span
                className={`p-1.5 rounded-md ${
                  activeTab === 'profile' ? 'bg-[#18e299]/15 text-[#18e299]' : 'bg-white/[0.03] text-neutral-400'
                }`}
              >
                <User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </span>
              <span>Profile &amp; Account</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('profile');
                setMobileMenuOpen(false);
              }}
              className={`min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-left ${
                activeTab === 'profile'
                  ? 'bg-surface-sunken text-text-primary border border-accent font-semibold'
                  : 'text-text-secondary hover:bg-surface-sunken'
              }`}
            >
              <User className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Profile &amp; Account</span>
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="min-h-[44px] flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-md text-status-danger-text bg-status-danger-bg border border-status-danger-border hover:opacity-90 transition-opacity text-left"
              >
                <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </nav>
      )}

      {/* Phone & Tablet Hamburger Navigation (< lg) */}
      <div className="lg:hidden border-b border-border-subtle bg-surface-raised px-4 py-2 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Menu
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md border border-border-strong bg-surface-sunken text-text-primary"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav aria-label="Mobile navigation" className="pt-2 pb-1 flex flex-col gap-1">
            {primaryItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`min-h-[44px] flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-left ${
                    isActive
                      ? 'bg-surface-sunken text-text-primary border border-accent font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-sunken'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-accent" aria-hidden="true" />
                    <span>{item.label}</span>
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setActiveTab('setup');
                setMobileMenuOpen(false);
              }}
              className={`min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-left ${
                activeTab === 'setup'
                  ? 'bg-surface-sunken text-text-primary border border-accent font-semibold'
                  : 'text-text-secondary hover:bg-surface-sunken'
              }`}
            >
              <Sliders className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>System Setup</span>
            </button>

            <Link
              to="/sandbox"
              onClick={() => setMobileMenuOpen(false)}
              className={`min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium ${
                activeTab === 'sandbox'
                  ? 'bg-surface-sunken text-text-primary border border-accent font-semibold'
                  : 'text-text-secondary hover:bg-surface-sunken'
              }`}
            >
              <Cpu className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Hardware Demo</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setActiveTab('about');
                setMobileMenuOpen(false);
              }}
              className={`min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-left ${
                activeTab === 'about'
                  ? 'bg-surface-sunken text-text-primary border border-accent font-semibold'
                  : 'text-text-secondary hover:bg-surface-sunken'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>About & Safety</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('profile');
                setMobileMenuOpen(false);
              }}
              className={`min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-left ${
                activeTab === 'profile'
                  ? 'bg-surface-sunken text-text-primary border border-accent font-semibold'
                  : 'text-text-secondary hover:bg-surface-sunken'
              }`}
            >
              <User className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Profile &amp; Account</span>
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-semibold text-status-danger-text bg-status-danger-bg border border-status-danger-border text-left"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>Logout</span>
              </button>
            )}
          </nav>
        )}
      </div>
    </>
  );
};
