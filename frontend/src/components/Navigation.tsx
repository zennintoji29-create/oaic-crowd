import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Radar,
  Cpu,
  Bell,
  Sliders,
  ShieldCheck,
  ExternalLink,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X
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

  const mainNavItems: NavTabItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'detail', label: 'Zone Details', icon: Radar },
    { id: 'alerts', label: 'Alerts & History', icon: Bell, count: alertCount },
    { id: 'about', label: 'About & Safety', icon: ShieldCheck }
  ];

  const toolItems: NavTabItem[] = [
    { id: 'setup', label: 'System Setup', icon: Sliders, to: '/setup' },
    // Hardware Demo placed last
    { id: 'sandbox', label: 'Hardware Demo', icon: Cpu, to: '/sandbox' }
  ];

  return (
    <>
      {/* Desktop / Laptop Left Sidebar Navigation (lg+) */}
      {navHidden ? (
        <div className="hidden lg:flex flex-col border-r border-border-subtle bg-surface-raised p-2 shrink-0">
          <button
            type="button"
            onClick={() => setNavHidden(false)}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md border border-border-strong bg-surface-sunken hover:bg-surface-overlay text-text-secondary hover:text-text-primary transition-colors"
            title="Show navigation bar"
            aria-label="Show navigation bar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <nav
          aria-label="Primary navigation"
          className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border-subtle bg-surface-raised p-3 gap-1 min-h-[calc(100dvh-72px)] justify-between"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between px-2 py-1 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Navigation
              </span>
              <button
                type="button"
                onClick={() => setNavHidden(true)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md hover:bg-surface-sunken text-text-muted hover:text-text-primary transition-colors"
                title="Hide navigation bar"
                aria-label="Hide navigation bar"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`min-h-[44px] flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors text-left ${
                    isActive
                      ? 'bg-surface-sunken text-text-primary border border-accent font-semibold'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-sunken'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-accent' : 'text-text-muted'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {typeof item.count === 'number' && item.count > 0 && (
                    <span className="text-xs px-1.5 py-0.5 border border-border-subtle rounded bg-surface-base text-status-danger-text tabular-nums">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="pt-3 mt-2 border-t border-border-subtle flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted px-2 py-1">
                Configuration & Demo
              </span>
              {toolItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <Link
                    key={item.id}
                    to={item.to || '/dashboard'}
                    className={`min-h-[44px] flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      isActive
                        ? 'bg-surface-sunken text-text-primary border border-accent font-semibold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-sunken'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-accent' : 'text-text-muted'}`} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-border-subtle flex flex-col gap-1.5">
            <Link
              to="/"
              className="min-h-[44px] flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md text-text-muted hover:text-text-primary hover:bg-surface-sunken transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-text-muted shrink-0" aria-hidden="true" />
              <span>Landing Page</span>
            </Link>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="min-h-[44px] flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-md text-status-danger-text bg-status-danger-bg border border-status-danger-border hover:opacity-90 transition-opacity text-left"
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
            {mainNavItems.map((item) => {
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

            <Link
              to="/setup"
              onClick={() => setMobileMenuOpen(false)}
              className="min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-text-secondary hover:bg-surface-sunken"
            >
              <Sliders className="w-4 h-4 text-text-muted" aria-hidden="true" />
              <span>System Setup</span>
            </Link>

            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-text-muted hover:bg-surface-sunken"
            >
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
              <span>Landing Page</span>
            </Link>

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

            {/* Hardware Demo last item */}
            <Link
              to="/sandbox"
              onClick={() => setMobileMenuOpen(false)}
              className="min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-text-secondary hover:bg-surface-sunken"
            >
              <Cpu className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Hardware Demo</span>
            </Link>
          </nav>
        )}
      </div>
    </>
  );
};
