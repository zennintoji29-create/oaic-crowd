import React from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Radar,
  Cpu,
  Bell,
  Sliders,
  ShieldCheck,
  SlidersHorizontal,
  ExternalLink,
  Lock
} from 'lucide-react';
import { getSessionToken } from '../lib/api';

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
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  alertCount
}) => {
  const isAuthenticated = Boolean(getSessionToken());

  const publicNavItems: NavTabItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'detail', label: 'Zone Details', icon: Radar },
    { id: 'alerts', label: 'Alerts & History', icon: Bell, count: alertCount },
    { id: 'about', label: 'About & Safety', icon: ShieldCheck }
  ];

  const operatorNavItems: NavTabItem[] = [
    { id: 'sandbox', label: 'Hardware Sandbox', icon: Cpu, to: '/sandbox' },
    { id: 'setup', label: 'System Setup', icon: Sliders, to: '/setup' },
    { id: 'remote', label: 'Manual Controls', icon: SlidersHorizontal, to: '/remote' }
  ];

  return (
    <>
      {/* Desktop Left Sidebar Navigation */}
      <nav
        aria-label="Primary navigation"
        className="hidden md:flex flex-col w-60 shrink-0 border-r border-border-subtle bg-surface-raised p-3 gap-1 min-h-[calc(100vh-85px)] justify-between"
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-2 py-1.5 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
              Operations View
            </span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
              LIVE
            </span>
          </div>

          {publicNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded transition-all text-left focus-visible:outline ${
                  isActive
                    ? 'bg-surface-sunken text-text-primary border border-emerald-500/50 shadow-sm font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-sunken/60'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-emerald-400' : 'text-text-muted'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="font-mono text-[10px] px-1.5 py-0.2 border border-border-subtle rounded bg-surface-base text-status-danger-text">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}

          {isAuthenticated && (
            <div className="pt-3 mt-2 border-t border-border-subtle flex flex-col gap-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted px-2 py-1">
                Operator Tools
              </span>
              {operatorNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <Link
                    key={item.id}
                    to={item.to || '/dashboard'}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded transition-all focus-visible:outline ${
                      isActive
                        ? 'bg-surface-sunken text-text-primary border border-emerald-500/50 font-semibold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-sunken/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-text-muted'}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Utility Links: Landing Page & Operator Login */}
        <div className="pt-3 mt-3 border-t border-border-subtle flex flex-col gap-1.5">
          {!isAuthenticated && (
            <Link
              to="/login"
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Operator Login</span>
            </Link>
          )}

          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded text-text-muted hover:text-text-primary hover:bg-surface-sunken transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span>Landing Page</span>
          </Link>
        </div>
      </nav>

      {/* Mobile Top Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden border-b border-border-subtle bg-surface-raised flex items-center overflow-x-auto p-1.5 gap-1 shrink-0 scrollbar-none"
      >
        {publicNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs whitespace-nowrap transition-colors focus-visible:outline ${
                isActive
                  ? 'bg-surface-sunken text-text-primary border border-emerald-500 font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{item.label}</span>
              {typeof item.count === 'number' && item.count > 0 && (
                <span className="font-mono text-[10px] px-1 py-0.2 border border-border-subtle rounded bg-surface-base text-status-danger-text">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}

        {!isAuthenticated ? (
          <Link
            to="/login"
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs whitespace-nowrap text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 font-semibold"
          >
            <Lock className="w-3 h-3" />
            <span>Login</span>
          </Link>
        ) : (
          <Link
            to="/remote"
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs whitespace-nowrap text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 font-semibold"
          >
            <span>Remote</span>
          </Link>
        )}

        <Link
          to="/"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs whitespace-nowrap text-text-muted hover:text-text-primary"
        >
          <span>Home</span>
        </Link>
      </nav>
    </>
  );
};
