import React from 'react';
import {
  LayoutDashboard,
  Radar,
  Cpu,
  Bell,
  Sliders,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  ExternalLink
} from 'lucide-react';

export interface NavTabItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  badge?: string;
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
  // Main 7 tabs strictly following wireframe
  const navItems: NavTabItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'detail', label: 'Zone Details', icon: Radar },
    { id: 'demo', label: 'Hardware Demo', icon: Cpu },
    { id: 'alerts', label: 'Alerts & History', icon: Bell, count: alertCount },
    { id: 'setup', label: 'System Setup', icon: Sliders },
    { id: 'about', label: 'About & Safety', icon: ShieldCheck },
    { id: 'manual', label: 'Manual Controls', icon: SlidersHorizontal, badge: 'OVERRIDE' }
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
              System Modules
            </span>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800">
              v2.4
            </span>
          </div>

          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded transition-all text-left focus-visible:outline ${
                  isActive
                    ? 'bg-surface-sunken text-text-primary border border-cyan-500/50 shadow-sm font-semibold'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-sunken/60'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-cyan-400' : 'text-text-muted'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {item.badge && (
                    <span className="font-mono text-[9px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                      {item.badge}
                    </span>
                  )}
                  {typeof item.count === 'number' && item.count > 0 && (
                    <span className="font-mono text-[10px] px-1.5 py-0.2 border border-border-subtle rounded bg-surface-base text-status-danger-text">
                      {item.count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Special Utility Links: Landing Page & Mobile Master Controller */}
        <div className="pt-3 mt-3 border-t border-border-subtle flex flex-col gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted px-2">
            Remote & Presentation
          </span>

          {/* Master Controller Shortcut */}
          <button
            onClick={() => setActiveTab('master')}
            className={`flex items-center justify-between px-3 py-2 text-xs font-medium rounded transition-all text-left border ${
              activeTab === 'master'
                ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500 shadow-sm font-semibold'
                : 'bg-surface-sunken/70 text-text-secondary border-border-subtle hover:border-cyan-500/50 hover:text-cyan-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Master Controller</span>
            </div>
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-cyan-900/50 text-cyan-300 border border-cyan-700">
              TOUCH
            </span>
          </button>

          {/* Landing Page Shortcut */}
          <button
            onClick={() => setActiveTab('landing')}
            className={`flex items-center justify-between px-3 py-1.5 text-xs font-medium rounded transition-all text-left border ${
              activeTab === 'landing'
                ? 'bg-surface-sunken text-text-primary border-border-strong font-semibold'
                : 'text-text-muted hover:text-text-primary border-transparent hover:bg-surface-sunken'
            }`}
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <span>Public Landing Page</span>
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile Top Navigation Bar (Horizontal Scrollable) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden border-b border-border-subtle bg-surface-raised flex items-center overflow-x-auto p-1.5 gap-1 shrink-0 scrollbar-none"
      >
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs whitespace-nowrap transition-colors focus-visible:outline ${
                isActive
                  ? 'bg-surface-sunken text-text-primary border border-cyan-500 font-semibold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{item.label}</span>
              {typeof item.count === 'number' && item.count > 0 && (
                <span className="font-mono text-[10px] px-1 py-0.2 border border-border-subtle rounded bg-surface-base text-status-danger-text">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Master Controller Mobile Button */}
        <button
          onClick={() => setActiveTab('master')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs whitespace-nowrap transition-colors border ${
            activeTab === 'master'
              ? 'bg-cyan-950 text-cyan-300 border-cyan-500 font-semibold'
              : 'bg-surface-sunken text-cyan-400 border-cyan-900/60 hover:border-cyan-500'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
          <span>Master</span>
        </button>

        {/* Landing Page Mobile Button */}
        <button
          onClick={() => setActiveTab('landing')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs whitespace-nowrap transition-colors ${
            activeTab === 'landing'
              ? 'bg-surface-sunken text-text-primary border border-border-strong font-semibold'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <span>Landing</span>
        </button>
      </nav>
    </>
  );
};
