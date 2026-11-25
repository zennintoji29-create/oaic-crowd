import React, { useState, useEffect, useCallback } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate
} from 'react-router-dom';
import {
  ZoneInfo,
  AlertRecord,
  CrowdState,
  TelemetryPoint,
  HardwareActuatorState,
  GateState
} from './types';
import {
  fetchZones,
  fetchAlerts,
  controlSimulator,
  fetchHardwareStatus,
  fetchGates,
  clearSessionToken
} from './lib/api';
import { GlobalHeader } from './components/GlobalHeader';
import { Navigation } from './components/Navigation';
import { OverviewTab } from './components/OverviewTab';
import { ZoneDetailTab } from './components/ZoneDetailTab';
import { AlertsTab } from './components/AlertsTab';
import { AboutTab } from './components/AboutTab';
import { DemoTab } from './components/DemoTab';
import { ManualControlTab } from './components/ManualControlTab';
import { MasterRemote } from './components/MasterRemote';
import { RequireAuth } from './components/RequireAuth';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Setup } from './pages/Setup';

const AppRoutes: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [dashboardTab, setDashboardTab] = useState<string>('overview');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('zone-entry-a');
  const [zones, setZones] = useState<ZoneInfo[]>([]);
  const [gates, setGates] = useState<GateState[]>([
    {
      id: 'gate-a',
      name: 'Main Temple Gate Alpha',
      zoneId: 'zone-entry-a',
      status: 'GREEN',
      count: 2,
      density: 0.8,
      riskScore: 18,
      servoAngle: 90,
      servoStatus: 'OPEN (90°)',
      isManualOverride: false,
      manualState: 'AUTO',
      power: true,
      lastUpdated: Date.now(),
      amberThreshold: 5,
      redThreshold: 10
    },
    {
      id: 'gate-b',
      name: 'North Pavilion Gate Beta',
      zoneId: 'zone-corridor-b',
      status: 'GREEN',
      count: 1,
      density: 0.4,
      riskScore: 12,
      servoAngle: 90,
      servoStatus: 'OPEN (90°)',
      isManualOverride: false,
      manualState: 'AUTO',
      power: true,
      lastUpdated: Date.now(),
      amberThreshold: 5,
      redThreshold: 10
    }
  ]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [hardware, setHardware] = useState<HardwareActuatorState | null>(null);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [lastTelemetryTimestamp, setLastTelemetryTimestamp] = useState<number>(Date.now());
  const [simulatorRunning, setSimulatorRunning] = useState<boolean>(false);
  const [isStale, setIsStale] = useState<boolean>(false);

  // Redirect ?tab=landing -> /
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'landing') {
      navigate('/', { replace: true });
    }
  }, [location.search, navigate]);

  // Compute worst state across gates and zones
  const computeWorstState = (): { state: CrowdState; zoneName: string } => {
    const redGate = gates.find((g) => g.status === 'RED');
    if (redGate) return { state: 'RED', zoneName: redGate.name };
    const redZone = zones.find((z) => z.currentStatus === 'RED');
    if (redZone) return { state: 'RED', zoneName: redZone.name };
    const amberGate = gates.find((g) => g.status === 'AMBER');
    if (amberGate) return { state: 'AMBER', zoneName: amberGate.name };
    const amberZone = zones.find((z) => z.currentStatus === 'AMBER');
    if (amberZone) return { state: 'AMBER', zoneName: amberZone.name };
    const greenGate = gates.find((g) => g.status === 'GREEN');
    if (greenGate) return { state: 'GREEN', zoneName: greenGate.name };
    const greenZone = zones.find((z) => z.currentStatus === 'GREEN');
    if (greenZone) return { state: 'GREEN', zoneName: greenZone.name };
    return { state: 'OFFLINE', zoneName: 'Offline' };
  };

  const worst = computeWorstState();

  const refreshData = useCallback(async () => {
    try {
      const [fetchedZones, fetchedGates, fetchedAlerts, fetchedHw] = await Promise.all([
        fetchZones().catch(() => []),
        fetchGates().catch(() => []),
        fetchAlerts(50).catch(() => []),
        fetchHardwareStatus().catch(() => null)
      ]);
      if (fetchedZones && fetchedZones.length > 0) setZones(fetchedZones);
      if (fetchedGates && fetchedGates.length > 0) setGates(fetchedGates);
      if (fetchedAlerts) setAlerts(fetchedAlerts);
      if (fetchedHw) setHardware(fetchedHw);
    } catch (err) {
      console.warn('[APP] Could not fetch initial REST data:', err);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleIncomingTelemetry = useCallback((point: TelemetryPoint) => {
    setLastTelemetryTimestamp(Date.now());
    setIsStale(false);

    setZones((prevZones) => {
      const existing = prevZones.find((z) => z.zoneId === point.zoneId);
      if (existing) {
        return prevZones.map((z) =>
          z.zoneId === point.zoneId
            ? {
                ...z,
                currentStatus: point.state,
                score: point.score,
                density: point.density,
                avgSpeed: point.avgSpeed,
                lastSeenMsAgo: 0,
                lastTelemetry: point
              }
            : z
        );
      }
      return [
        ...prevZones,
        {
          zoneId: point.zoneId,
          name: `Zone ${point.zoneId}`,
          areaSqM: 24.0,
          corridorWidthM: 4.0,
          deviceId: point.deviceId,
          currentStatus: point.state,
          score: point.score,
          density: point.density,
          avgSpeed: point.avgSpeed,
          lastSeenMsAgo: 0,
          lastTelemetry: point
        }
      ];
    });
  }, []);

  // WebSocket Connection Lifecycle
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: any = null;

    function connect() {
      const envWs = (import.meta as any).env?.VITE_WS_URL;
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const wsHost = window.location.port === '5173' ? 'localhost:3000' : window.location.host;
      const wsUrl = envWs || `${wsProtocol}//${wsHost}`;

      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => setIsWsConnected(true);
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'INITIAL_STATE') {
              if (msg.data.zones) setZones(msg.data.zones);
              if (msg.data.gates) setGates(msg.data.gates);
              if (msg.data.alerts) setAlerts(msg.data.alerts);
              if (msg.data.hardware) setHardware(msg.data.hardware);
              if (typeof msg.data.simulatorRunning === 'boolean') {
                setSimulatorRunning(msg.data.simulatorRunning);
              }
              setLastTelemetryTimestamp(Date.now());
            } else if (msg.type === 'TELEMETRY_UPDATE') {
              handleIncomingTelemetry(msg.data);
            } else if (msg.type === 'GATE_UPDATED') {
              setGates((prev) =>
                prev.map((g) => (g.id === msg.data.id ? { ...g, ...msg.data } : g))
              );
            } else if (msg.type === 'HARDWARE_UPDATE' || msg.type === 'FAILOVER_ALERT') {
              setHardware(msg.data);
            } else if (msg.type === 'SIMULATOR_STATE') {
              setSimulatorRunning(msg.data.isRunning);
            } else if (msg.type === 'ZONE_CONFIG_UPDATED') {
              setZones((prev) =>
                prev.map((z) => (z.zoneId === msg.data.zoneId ? { ...z, ...msg.data } : z))
              );
            }
          } catch (e) {
            console.error('[WS] Error parsing message:', e);
          }
        };
        ws.onerror = () => setIsWsConnected(false);
        ws.onclose = () => {
          setIsWsConnected(false);
          reconnectTimer = setTimeout(connect, 2000);
        };
      } catch {
        setIsWsConnected(false);
        reconnectTimer = setTimeout(connect, 2000);
      }
    }

    connect();
    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [handleIncomingTelemetry]);

  // Stale Telemetry Timer (>5s)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      if (now - lastTelemetryTimestamp > 5000) {
        setIsStale(true);
      }
      setZones((prev) =>
        prev.map((z) => ({
          ...z,
          lastSeenMsAgo: z.lastTelemetry
            ? now - (z.lastTelemetry.serverTimestamp || z.lastTelemetry.timestamp)
            : null
        }))
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [lastTelemetryTimestamp]);

  const handleToggleSimulator = async () => {
    try {
      const res = await controlSimulator('toggle');
      setSimulatorRunning(res.simulatorRunning);
    } catch (err) {
      console.error('Failed to toggle simulator:', err);
    }
  };

  const handleSelectZone = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    setDashboardTab('detail');
  };

  const handleGateUpdated = (updatedGate: GateState) => {
    setGates((prev) => prev.map((g) => (g.id === updatedGate.id ? updatedGate : g)));
  };

  const handleLogout = useCallback(() => {
    try {
      clearSessionToken();
    } finally {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  // Shared Dashboard Shell for /dashboard and /sandbox
  const renderShell = (activeKey: string, content: React.ReactNode) => (
    <div className="min-h-screen flex flex-col bg-surface-base text-text-primary antialiased">
      <GlobalHeader
        worstState={worst.state}
        worstZoneName={worst.zoneName}
        isWsConnected={isWsConnected}
        isStale={isStale}
        simulatorRunning={simulatorRunning}
        onToggleSimulator={handleToggleSimulator}
        onLogout={handleLogout}
      />
      <div className="flex-1 flex flex-col md:flex-row">
        <Navigation
          activeTab={activeKey}
          setActiveTab={(tab) => {
            setDashboardTab(tab);
            if (location.pathname !== '/dashboard') {
              navigate('/dashboard');
            }
          }}
          alertCount={alerts.length}
          onLogout={handleLogout}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">{content}</main>
      </div>
    </div>
  );

  return (
    <Routes>
      {/* Public Landing Page */}
      <Route path="/" element={<Landing />} />

      {/* Protected Dashboard (requires login) */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            {renderShell(
              dashboardTab,
              <>
                {dashboardTab === 'overview' && (
                  <OverviewTab
                    zones={zones}
                    gates={gates}
                    worstState={worst.state}
                    hardware={hardware}
                    onSelectZone={handleSelectZone}
                    onGateUpdated={handleGateUpdated}
                  />
                )}
                {dashboardTab === 'detail' && (
                  <ZoneDetailTab
                    zones={zones}
                    selectedZoneId={selectedZoneId}
                    onSelectZoneId={setSelectedZoneId}
                  />
                )}
                {dashboardTab === 'alerts' && <AlertsTab alerts={alerts} />}
                {dashboardTab === 'about' && <AboutTab />}
              </>
            )}
          </RequireAuth>
        }
      />

      {/* Public Operator Login */}
      <Route path="/login" element={<Login />} />

      {/* Protected Initial Setup Wizard */}
      <Route
        path="/setup"
        element={
          <RequireAuth>
            <Setup />
          </RequireAuth>
        }
      />

      {/* Protected Hardware Sandbox */}
      <Route
        path="/sandbox"
        element={
          <RequireAuth>
            {renderShell('sandbox', <DemoTab hardware={hardware} />)}
          </RequireAuth>
        }
      />

      {/* Protected Manual Controls / Master Remote */}
      <Route
        path="/remote"
        element={
          <RequireAuth>
            <div className="min-h-screen bg-slate-950">
              <MasterRemote initialGates={gates} />
              <div className="hidden lg:block max-w-7xl mx-auto px-6 pb-12">
                <ManualControlTab
                  gates={gates}
                  hardware={hardware}
                  onRefreshGates={refreshData}
                />
              </div>
            </div>
          </RequireAuth>
        }
      />

      {/* Redirect /master -> /remote */}
      <Route path="/master" element={<Navigate to="/remote" replace />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
};
