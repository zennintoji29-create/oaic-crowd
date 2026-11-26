import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  User,
  Wifi,
  Home
} from 'lucide-react';
import { BranchedMenu, BranchedMenuItem } from './reactbits';

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
  const navigate = useNavigate();
  const [navHidden, setNavHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems: BranchedMenuItem[] = useMemo(
    () => [
      {
        label: 'Monitoring',
        children: [
          { value: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
          { value: 'detail', label: 'Zone Details', icon: <Radar className="w-3.5 h-3.5" /> },
          { value: 'alerts', label: 'Alerts & History', icon: <Bell className="w-3.5 h-3.5" />, badge: alertCount }
        ]
      },
      {
        label: 'Configuration & Demo',
        children: [
          { value: 'hardware', label: 'ESP32 & Fallback', icon: <Wifi className="w-3.5 h-3.5" /> },
          { value: 'setup', label: 'System Setup', icon: <Sliders className="w-3.5 h-3.5" /> },
          { value: 'sandbox', label: 'Hardware Demo', icon: <Cpu className="w-3.5 h-3.5" /> }
        ]
      },
      {
        label: 'Docs & Account',
        children: [
          { value: 'about', label: 'About & Safety', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
          { value: 'profile', label: 'Profile & Account', icon: <User className="w-3.5 h-3.5" /> }
        ]
      }
    ],
    [alertCount]
  );

  const handleSelectItem = (value: string) => {
    setMobileMenuOpen(false);
    if (value === 'sandbox') {
      navigate('/sandbox');
      return;
    }
    setActiveTab(value);
  };

  return (
    <>
      {/* Desktop / Laptop Left Sidebar with React Bits BranchedMenu (lg+) */}
      {navHidden ? (
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
        <aside
          aria-label="Primary navigation"
          className="hidden lg:flex flex-col w-64 shrink-0 border-r border-white/[0.08] bg-[#0a0c0e]/95 p-3 sticky top-[61px] h-[calc(100dvh-61px)] overflow-y-auto justify-between gap-4"
        >
          <div className="flex flex-col gap-3">
            {/* Compact Control Panel Status Header + Home */}
            <div className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07]">
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

            <Link
              to="/"
              className="min-h-[40px] flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-white/[0.07] bg-white/[0.02] text-neutral-300 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              <Home className="w-3.5 h-3.5 text-[#18e299]" aria-hidden="true" />
              <span>Home</span>
            </Link>

            <BranchedMenu
              items={menuItems}
              defaultOpen={[0, 1, 2]}
              activeValue={activeTab}
              onSelect={handleSelectItem}
              accentColor="#18e299"
              color="#f5f5f5"
              lineColor="rgba(255, 255, 255, 0.12)"
              width={226}
              rowHeight={38}
              indent={34}
              trunk={10}
              radius={9}
              fontSize={13}
            />
          </div>

          {/* Bottom Logout */}
          <div className="pt-2 border-t border-white/[0.07] flex flex-col gap-1.5">
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
        </aside>
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
          <div className="pt-3 pb-2 space-y-3">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium border border-white/[0.08] bg-white/[0.03] text-neutral-200"
            >
              <Home className="w-4 h-4 text-[#18e299]" aria-hidden="true" />
              <span>Home</span>
            </Link>

            <BranchedMenu
              items={menuItems}
              defaultOpen={[0, 1, 2]}
              activeValue={activeTab}
              onSelect={handleSelectItem}
              accentColor="#18e299"
              color="#f5f5f5"
              lineColor="rgba(255, 255, 255, 0.14)"
              width={320}
              rowHeight={42}
              indent={36}
              trunk={10}
              radius={9}
              fontSize={14}
            />

            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-semibold text-status-danger-text bg-status-danger-bg border border-status-danger-border text-left"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>Logout</span>
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
};
