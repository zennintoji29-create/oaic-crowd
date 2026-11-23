import React, { useState, useEffect, useCallback } from 'react';
import {
  ZoneInfo,
  AlertRecord,
  CrowdState,
  TelemetryPoint,
  HardwareActuatorState,
  KeepAliveStats,
  GateState,
  SystemConfig
} from './types';
import {
  fetchZones,
  fetchAlerts,
  controlSimulator,
  fetchHardwareStatus,
  fetchKeepAliveStats,
  triggerKeepAlivePing,
  fetchGates,
  fetchSystemConfig
} from './lib/api';
import { GlobalHeader } from './components/GlobalHeader';
import { Navigation } from './components/Navigation';
import { OverviewTab } from './components/OverviewTab';
import { ZoneDetailTab } from './components/ZoneDetailTab';
import { AlertsTab } from './components/AlertsTab';
import { SetupTab } from './components/SetupTab';
import { AboutTab } from './components/AboutTab';
import { DemoTab } from './components/DemoTab';
import { ManualControlTab } from './components/ManualControlTab';
import { MasterRemote } from './components/MasterRemote';
import { LandingPage } from './components/LandingPage';
import { InitialSetup } from './components/InitialSetup';

export const App: React.FC = () => {
  // Check if accessing the private stealth remote endpoint via URL path or query
  const isPrivateRemote =
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/remote') ||
      window.location.pathname.startsWith('/master') ||
      new URLSearchParams(window.location.search).get('tab') === 'remote' ||
      new URLSearchParams(window.location.search).get('tab') === 'master');

  const initialTab =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('tab') || 'overview'
      : 'overview';

  const [activeTab, setActiveTab] = useState<string>(initialTab);
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
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [lastTelemetryTimestamp, setLastTelemetryTimestamp] = useState<number>(Date.now());
  const [simulatorRunning, setSimulatorRunning] = useState<boolean>(false);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [keepAliveStats, setKeepAliveStats] = useState<KeepAliveStats | null>(null);

  // Manual keep-alive ping trigger
  const handleTriggerPing = useCallback(async () => {
    try {
      const stats = await triggerKeepAlivePing();
      setKeepAliveStats(stats);
      console.log('[Render-AntiSleep] Manual keep-alive ping triggered:', stats.lastPingStatus);
    } catch (err) {
      console.warn('[Render-AntiSleep] Manual ping failed:', err);
    }
  }, []);

  // Automated 10-minute Render Anti-Sleep Keep-Alive loop
  // Pings backend on startup (waking it up if cold) and every 9.5 minutes
  useEffect(() => {
    let timer: any = null;

    const runPing = async () => {
      try {
        const stats = await triggerKeepAlivePing();
        setKeepAliveStats(stats);
      } catch (err) {
        fetchKeepAliveStats().then(setKeepAliveStats).catch(() => null);
      }
    };

    // Immediate initial ping on mount
    runPing();

    // 9.5 minutes (570,000 ms) interval to comfortably beat Render's 15-minute inactivity spin-down
    timer = setInterval(runPing, 570000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  // Compute worst state across zones and gates
  const computeWorstState = (): { state: CrowdState; zoneName: string } => {
    // Check gates first
    const redGate = gates.find(g => g.status === 'RED');
    if (redGate) return { state: 'RED', zoneName: redGate.name };

    const redZone = zones.find(z => z.currentStatus === 'RED');
    if (redZone) return { state: 'RED', zoneName: redZone.name };

    const amberGate = gates.find(g => g.status === 'AMBER');
    if (amberGate) return { state: 'AMBER', zoneName: amberGate.name };

    const amberZone = zones.find(z => z.currentStatus === 'AMBER');
    if (amberZone) return { state: 'AMBER', zoneName: amberZone.name };

    const greenGate = gates.find(g => g.status === 'GREEN');
    if (greenGate) return { state: 'GREEN', zoneName: greenGate.name };

    const greenZone = zones.find(z => z.currentStatus === 'GREEN');
    if (greenZone) return { state: 'GREEN', zoneName: greenZone.name };

    return { state: 'OFFLINE', zoneName: 'Offline' };
  };

  const worst = computeWorstState();

  // Load initial data via REST API
  const refreshData = useCallback(async () => {
    try {
      const [fetchedZones, fetchedGates, fetchedAlerts, fetchedHw, fetchedCfg] = await Promise.all([
        fetchZones().catch(() => []),
        fetchGates().catch(() => []),
        fetchAlerts(50).catch(() => []),
        fetchHardwareStatus().catch(() => null),
        fetchSystemConfig().catch(() => null)
      ]);

      if (fetchedZones && fetchedZones.length > 0) setZones(fetchedZones);
      if (fetchedGates && fetchedGates.length > 0) setGates(fetchedGates);
      if (fetchedAlerts) setAlerts(fetchedAlerts);
      if (fetchedHw) setHardware(fetchedHw);
      if (fetchedCfg) setSystemConfig(fetchedCfg);
    } catch (err) {
      console.warn('[APP] Could not fetch initial REST data:', err);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Handle incoming live telemetry record
  const handleIncomingTelemetry = useCallback((point: TelemetryPoint) => {
    setLastTelemetryTimestamp(Date.now());
    setIsStale(false);

    setZones(prevZones => {
      const existing = prevZones.find(z => z.zoneId === point.zoneId);
      if (existing) {
        return prevZones.map(z => {
          if (z.zoneId === point.zoneId) {
            return {
              ...z,
              currentStatus: point.state,
              score: point.score,
              density: point.density,
              avgSpeed: point.avgSpeed,
              lastSeenMsAgo: 0,
              lastTelemetry: point
            };
          }
          return z;
        });
      } else {
        const newZone: ZoneInfo = {
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
        };
        return [...prevZones, newZone];
      }
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

        ws.onopen = () => {
          setIsWsConnected(true);
          console.log('[WS] Connected to Crowd Pressure Radar backend at', wsUrl);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'INITIAL_STATE') {
              if (msg.data.zones) setZones(msg.data.zones);
              if (msg.data.gates) setGates(msg.data.gates);
              if (msg.data.alerts) setAlerts(msg.data.alerts);
              if (msg.data.hardware) setHardware(msg.data.hardware);
              if (msg.data.config) setSystemConfig(msg.data.config);
              if (typeof msg.data.simulatorRunning === 'boolean') {
                setSimulatorRunning(msg.data.simulatorRunning);
              }
              setLastTelemetryTimestamp(Date.now());
            } else if (msg.type === 'TELEMETRY_UPDATE') {
              handleIncomingTelemetry(msg.data);
            } else if (msg.type === 'GATE_UPDATED') {
              setGates(prev =>
                prev.map(g => (g.id === msg.data.id ? { ...g, ...msg.data } : g))
              );
            } else if (msg.type === 'HARDWARE_UPDATE' || msg.type === 'FAILOVER_ALERT') {
              setHardware(msg.data);
            } else if (msg.type === 'SIMULATOR_STATE') {
              setSimulatorRunning(msg.data.isRunning);
            } else if (msg.type === 'ZONE_CONFIG_UPDATED') {
              setZones(prev =>
                prev.map(z => (z.zoneId === msg.data.zoneId ? { ...z, ...msg.data } : z))
              );
            }
          } catch (e) {
            console.error('[WS] Error parsing message:', e);
          }
        };

        ws.onerror = () => {
          setIsWsConnected(false);
        };

        ws.onclose = () => {
          setIsWsConnected(false);
          reconnectTimer = setTimeout(connect, 2000);
        };
      } catch (err) {
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

  // Stale Telemetry Timer (> 5s threshold requirement)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const age = now - lastTelemetryTimestamp;
      if (age > 5000) {
        setIsStale(true);
      }

      setZones(prev =>
        prev.map(z => ({
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
    setActiveTab('detail');
  };

  const handleZoneUpdated = (updated: ZoneInfo) => {
    setZones(prev => prev.map(z => (z.zoneId === updated.zoneId ? { ...z, ...updated } : z)));
  };

  const handleGateUpdated = (updatedGate: GateState) => {
    setGates(prev => prev.map(g => (g.id === updatedGate.id ? updatedGate : g)));
  };

  // Isolated Private Master Remote View (Never rendered inside dashboard shell)
  if (isPrivateRemote) {
    return <MasterRemote initialGates={gates} />;
  }

  // Full-page views: Landing Page & Initial Setup
  if (activeTab === 'landing') {
    return (
      <LandingPage
        onEnterDashboard={() => setActiveTab('overview')}
        onOpenSetup={() => setActiveTab('initial_setup')}
        gates={gates}
        hardware={hardware}
        worstState={worst.state}
      />
    );
  }

  if (activeTab === 'initial_setup') {
    return (
      <InitialSetup
        onSetupComplete={() => setActiveTab('overview')}
        onBackToLanding={() => setActiveTab('landing')}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-base text-text-primary antialiased">
      {/* 1. Global Header: Product name, purpose, connection status, worst state pill */}
      <GlobalHeader
        worstState={worst.state}
        worstZoneName={worst.zoneName}
        isWsConnected={isWsConnected}
        isStale={isStale}
        simulatorRunning={simulatorRunning}
        onToggleSimulator={handleToggleSimulator}
        keepAliveStats={keepAliveStats}
        onTriggerPing={handleTriggerPing}
      />

      {/* 2. Main Content Body with Desktop Left Navigation and Mobile Top Flow */}
      <div className="flex-1 flex flex-col md:flex-row">
        <Navigation
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          alertCount={alerts.length}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'overview' && (
            <OverviewTab
              zones={zones}
              gates={gates}
              worstState={worst.state}
              hardware={hardware}
              onSelectZone={handleSelectZone}
              onGateUpdated={handleGateUpdated}
            />
          )}

          {activeTab === 'detail' && (
            <ZoneDetailTab
              zones={zones}
              selectedZoneId={selectedZoneId}
              onSelectZoneId={setSelectedZoneId}
            />
          )}

          {activeTab === 'demo' && (
            <DemoTab hardware={hardware} />
          )}

          {activeTab === 'alerts' && <AlertsTab alerts={alerts} />}

          {activeTab === 'setup' && (
            <SetupTab zones={zones} onZoneUpdated={handleZoneUpdated} />
          )}

          {activeTab === 'about' && <AboutTab />}

          {activeTab === 'manual' && (
            <ManualControlTab
              gates={gates}
              hardware={hardware}
              onRefreshGates={refreshData}
            />
          )}
        </main>
      </div>
    </div>
  );
};
