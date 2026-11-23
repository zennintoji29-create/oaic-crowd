import {
  ZoneInfo,
  TelemetryPoint,
  AlertRecord,
  OperatorCommand,
  HardwareActuatorState,
  KeepAliveStats,
  GateState,
  SystemConfig,
  TrafficAnalytics
} from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

export async function fetchZones(): Promise<ZoneInfo[]> {
  const res = await fetch(`${API_BASE}/zones`);
  if (!res.ok) throw new Error('Failed to fetch zones');
  const data = await res.json();
  return data.zones;
}

export async function fetchGates(): Promise<GateState[]> {
  const res = await fetch(`${API_BASE}/gates`);
  if (!res.ok) throw new Error('Failed to fetch gates');
  const data = await res.json();
  return data.gates;
}

export async function controlGateOverride(gateId: string, manualState: string): Promise<GateState> {
  const res = await fetch(`${API_BASE}/gates/${encodeURIComponent(gateId)}/override`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ manualState })
  });
  if (!res.ok) throw new Error('Failed to override gate state');
  const data = await res.json();
  return data.gate;
}

export async function controlGatePower(gateId: string, power: boolean): Promise<GateState> {
  const res = await fetch(`${API_BASE}/gates/${encodeURIComponent(gateId)}/power`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ power })
  });
  if (!res.ok) throw new Error('Failed to toggle gate power');
  const data = await res.json();
  return data.gate;
}

export async function adjustGateDensity(gateId: string, delta: number): Promise<GateState> {
  const res = await fetch(`${API_BASE}/gates/${encodeURIComponent(gateId)}/density`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delta })
  });
  if (!res.ok) throw new Error('Failed to adjust gate density');
  const data = await res.json();
  return data.gate;
}

export async function fetchSystemConfig(): Promise<SystemConfig> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error('Failed to fetch system config');
  const data = await res.json();
  return data.config;
}

export async function updateSystemConfig(config: Partial<SystemConfig>): Promise<SystemConfig> {
  const res = await fetch(`${API_BASE}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!res.ok) throw new Error('Failed to save system config');
  const data = await res.json();
  return data.config;
}

export async function fetchAnalytics(): Promise<TrafficAnalytics> {
  const res = await fetch(`${API_BASE}/analytics`);
  if (!res.ok) throw new Error('Failed to fetch analytics');
  const data = await res.json();
  return data.analytics;
}

export async function fetchHardwareStatus(): Promise<HardwareActuatorState> {
  const res = await fetch(`${API_BASE}/esp32/status`);
  if (!res.ok) throw new Error('Failed to fetch hardware status');
  return res.json();
}

export async function simulateSandbox(count: number, cameraOnline?: boolean, gateId?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count, cameraOnline, gateId })
  });
  if (!res.ok) throw new Error('Failed to send simulation payload');
  return res.json();
}

export async function fetchZoneHistory(zoneId: string, minutes = 10): Promise<TelemetryPoint[]> {
  const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}/history?minutes=${minutes}`);
  if (!res.ok) throw new Error('Failed to fetch zone history');
  const data = await res.json();
  return data.history;
}

export async function fetchAlerts(limit = 100): Promise<AlertRecord[]> {
  const res = await fetch(`${API_BASE}/alerts?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch alerts');
  const data = await res.json();
  return data.alerts;
}

export async function sendOperatorCommand(
  deviceId: string,
  command: OperatorCommand,
  reason: string
): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, command, reason })
  });
  if (!res.ok) throw new Error('Failed to send command');
  return res.json();
}

export async function updateZoneConfig(
  zoneId: string,
  updates: { name?: string; areaSqM?: number; corridorWidthM?: number }
): Promise<ZoneInfo> {
  const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update zone config');
  const data = await res.json();
  return data.zone;
}

export async function controlSimulator(action: 'start' | 'stop' | 'toggle' | 'tick'): Promise<{ simulatorRunning: boolean }> {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action })
  });
  if (!res.ok) throw new Error('Failed to control simulator');
  return res.json();
}

export async function fetchKeepAliveStats(): Promise<KeepAliveStats> {
  const res = await fetch(`${API_BASE}/keepalive`);
  if (!res.ok) throw new Error('Failed to fetch keep-alive stats');
  const data = await res.json();
  return data.keepAlive;
}

export async function triggerKeepAlivePing(): Promise<KeepAliveStats> {
  const res = await fetch(`${API_BASE}/keepalive/ping`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to trigger keep-alive ping');
  const data = await res.json();
  return data.keepAlive;
}

// ============================================================================
// PRIVATE MASTER REMOTE API (Silent background presentation controls)
// ============================================================================
export async function authenticateMaster(key: string): Promise<{ success: boolean; token: string }> {
  const res = await fetch(`${API_BASE}/master/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: key.trim() })
  });
  if (!res.ok) throw new Error('Invalid master authentication passcode');
  return res.json();
}

export async function sendMasterCommand(token: string, payload: { action: string; [key: string]: any }): Promise<any> {
  const res = await fetch(`${API_BASE}/master/command`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-master-token': token
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('AUTH_EXPIRED');
    throw new Error('Failed to execute silent command');
  }
  return res.json();
}



