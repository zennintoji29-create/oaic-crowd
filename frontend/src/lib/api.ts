import {
  ZoneInfo,
  TelemetryPoint,
  AlertRecord,
  OperatorCommand,
  HardwareActuatorState,
  KeepAliveStats,
  GateState,
  SystemConfig,
  TrafficAnalytics,
  OperatorProfile,
  AuditLogEntry
} from '../types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';
const TOKEN_STORAGE_KEY = 'cpr_master_token';

export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setSessionToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearSessionToken(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function getTokenExpiryMs(): number | null {
  const token = getSessionToken();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getSessionToken();
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...init, headers });
}

export async function fetchZones(): Promise<ZoneInfo[]> {
  const res = await authFetch(`${API_BASE}/zones`);
  if (!res.ok) throw new Error('Failed to fetch zones');
  const data = await res.json();
  return data.zones;
}

export async function fetchGates(): Promise<GateState[]> {
  const res = await authFetch(`${API_BASE}/gates`);
  if (!res.ok) throw new Error('Failed to fetch gates');
  const data = await res.json();
  return data.gates;
}

export async function controlGateOverride(gateId: string, manualState: string): Promise<GateState> {
  const res = await authFetch(`${API_BASE}/gates/${encodeURIComponent(gateId)}/override`, {
    method: 'POST',
    body: JSON.stringify({ manualState })
  });
  if (!res.ok) throw new Error('Failed to override gate state');
  const data = await res.json();
  return data.gate;
}

export async function controlGatePower(gateId: string, power: boolean): Promise<GateState> {
  const res = await authFetch(`${API_BASE}/gates/${encodeURIComponent(gateId)}/power`, {
    method: 'POST',
    body: JSON.stringify({ power })
  });
  if (!res.ok) throw new Error('Failed to toggle gate power');
  const data = await res.json();
  return data.gate;
}

export async function adjustGateDensity(gateId: string, delta: number): Promise<GateState> {
  const res = await authFetch(`${API_BASE}/gates/${encodeURIComponent(gateId)}/density`, {
    method: 'POST',
    body: JSON.stringify({ delta })
  });
  if (!res.ok) throw new Error('Failed to adjust gate density');
  const data = await res.json();
  return data.gate;
}

export async function resetAllGates(): Promise<GateState[]> {
  const res = await authFetch(`${API_BASE}/gates/reset-all`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to reset gates');
  const data = await res.json();
  return data.gates;
}

export async function fetchSystemConfig(): Promise<SystemConfig> {
  const res = await authFetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error('Failed to fetch system config');
  const data = await res.json();
  return data.config;
}

export async function updateSystemConfig(config: Partial<SystemConfig> & Record<string, any>): Promise<SystemConfig> {
  const res = await authFetch(`${API_BASE}/config`, {
    method: 'POST',
    body: JSON.stringify(config)
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('AUTH_EXPIRED');
    throw new Error('Failed to save system config');
  }
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
  const res = await authFetch(`${API_BASE}/simulate`, {
    method: 'POST',
    body: JSON.stringify({ count, cameraOnline, gateId })
  });
  if (!res.ok) throw new Error('Failed to send simulation payload');
  return res.json();
}

export async function fetchZoneHistory(zoneId: string, minutes = 10): Promise<TelemetryPoint[]> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}/history?minutes=${minutes}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!res.ok) throw new Error('Failed to fetch zone history');
  const data = await res.json();
  return data.history;
}

export async function fetchAlerts(limit = 100): Promise<AlertRecord[]> {
  const token = getSessionToken();
  const res = await fetch(`${API_BASE}/alerts?limit=${limit}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!res.ok) throw new Error('Failed to fetch alerts');
  const data = await res.json();
  return data.alerts;
}

export async function sendOperatorCommand(
  deviceId: string,
  command: OperatorCommand,
  reason: string
): Promise<{ status: string }> {
  const res = await authFetch(`${API_BASE}/commands`, {
    method: 'POST',
    body: JSON.stringify({ deviceId, command, reason })
  });
  if (!res.ok) throw new Error('Failed to send command');
  return res.json();
}

export async function updateZoneConfig(
  zoneId: string,
  updates: { name?: string; areaSqM?: number; corridorWidthM?: number }
): Promise<ZoneInfo> {
  const res = await authFetch(`${API_BASE}/zones/${encodeURIComponent(zoneId)}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to update zone config');
  const data = await res.json();
  return data.zone;
}

export async function controlSimulator(action: 'start' | 'stop' | 'toggle' | 'tick'): Promise<{ simulatorRunning: boolean }> {
  const res = await authFetch(`${API_BASE}/simulate`, {
    method: 'POST',
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
// OPERATOR AUTHENTICATION (EMAIL + PHONE + PASSWORD)
// ============================================================================
export async function signupOperator(
  email: string,
  phone: string,
  password: string
): Promise<{ success: boolean; token: string; setupComplete: boolean }> {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), phone: phone.trim(), password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to create account');
  }
  return data;
}

export async function loginOperator(
  email: string,
  password: string
): Promise<{ success: boolean; token: string; setupComplete: boolean }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 429) throw new Error('Too many login attempts. Please wait.');
    throw new Error(data.error || 'Invalid email or password');
  }
  return data;
}

export async function verifyOperatorPassword(password: string): Promise<{ success: boolean; email: string }> {
  const res = await authFetch(`${API_BASE}/auth/verify-password`, {
    method: 'POST',
    body: JSON.stringify({ password })
  });
  if (!res.ok) {
    throw new Error('Invalid password');
  }
  return res.json();
}

export async function fetchOperatorProfile(): Promise<{ user: OperatorProfile; sessionExpiresAt: number | null }> {
  const res = await authFetch(`${API_BASE}/auth/me`);
  if (!res.ok) {
    if (res.status === 401) throw new Error('AUTH_EXPIRED');
    throw new Error('Failed to load profile');
  }
  return res.json();
}

export async function updateOperatorProfile(payload: {
  email?: string;
  phone?: string;
  displayName?: string;
  currentPassword?: string;
}): Promise<{ success: boolean; user: OperatorProfile; token?: string | null }> {
  const res = await authFetch(`${API_BASE}/auth/profile`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update profile');
  }
  return data;
}

export async function changeOperatorPassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean }> {
  const res = await authFetch(`${API_BASE}/auth/password`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update password');
  }
  return data;
}

export async function updateGateSettings(
  gateId: string,
  payload: { name?: string; amberThreshold?: number; redThreshold?: number; cameraStreamUrl?: string }
): Promise<GateState> {
  const res = await authFetch(`${API_BASE}/gates/${encodeURIComponent(gateId)}/settings`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to update gate settings');
  }
  return data.gate;
}

export async function addGate(payload: {
  name?: string;
  amberThreshold?: number;
  redThreshold?: number;
  cameraStreamUrl?: string;
}): Promise<{ gate: GateState; gates: GateState[] }> {
  const res = await authFetch(`${API_BASE}/gates`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to add gate');
  }
  return data;
}

export async function removeGate(gateId: string): Promise<GateState[]> {
  const res = await authFetch(`${API_BASE}/gates/${encodeURIComponent(gateId)}`, {
    method: 'DELETE'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to remove gate');
  }
  return data.gates;
}

export async function acknowledgeAlert(alertId: string, note = ''): Promise<AlertRecord> {
  const res = await authFetch(`${API_BASE}/alerts/${encodeURIComponent(alertId)}/ack`, {
    method: 'POST',
    body: JSON.stringify({ note })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Failed to acknowledge alert');
  }
  return data.alert;
}

export async function fetchAuditLogs(limit = 100): Promise<AuditLogEntry[]> {
  const res = await authFetch(`${API_BASE}/audit?limit=${limit}`);
  if (!res.ok) {
    if (res.status === 401) throw new Error('AUTH_EXPIRED');
    throw new Error('Failed to load audit logs');
  }
  const data = await res.json();
  return data.auditLogs || [];
}

// ============================================================================
// ESP32 WI-FI HARDWARE MANAGER, FALLBACK & COMBINED DEMO API
// ============================================================================
export async function fetchHardwareManagerState(): Promise<any> {
  const res = await authFetch(`${API_BASE}/hardware/state`);
  if (!res.ok) throw new Error('Failed to fetch hardware manager state');
  const data = await res.json();
  return data.hardware;
}

export async function setHardwareOperatingMode(
  mode: 'AI_CAMERA' | 'HARDWARE_FALLBACK' | 'COMBINED_DEMO'
): Promise<{ status: string; mode?: string; error?: string; hardware?: any }> {
  const res = await authFetch(`${API_BASE}/hardware/mode`, {
    method: 'POST',
    body: JSON.stringify({ mode })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data.error || 'Failed to switch operating mode');
    err.hardware = data.hardware;
    throw err;
  }
  return data;
}

export async function sendHardwareCommand(payload: {
  deviceId?: string;
  type: 'GATE_OPEN' | 'GATE_CLOSE' | 'GATE_METER' | 'SERVO_TEST' | 'GATE_RESET' | 'BUZZER_OFF' | 'SYNC_ALERT';
  alertLevel?: 'GREEN' | 'AMBER' | 'RED';
  servoAngle?: number;
}): Promise<any> {
  const res = await authFetch(`${API_BASE}/hardware/command`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to send hardware command');
  return res.json();
}

export async function sendHardwareDemo(
  action: 'SET_ALERT' | 'RESET',
  alertLevel?: 'GREEN' | 'AMBER' | 'RED'
): Promise<any> {
  const res = await authFetch(`${API_BASE}/hardware/demo`, {
    method: 'POST',
    body: JSON.stringify({ action, alertLevel })
  });
  if (!res.ok) throw new Error('Failed to update demonstration mode');
  return res.json();
}

// ============================================================================
// PROTECTED MASTER REMOTE API
// ============================================================================
export async function authenticateMaster(
  credential: string
): Promise<{ success: boolean; token: string; setupComplete?: boolean }> {
  const res = await fetch(`${API_BASE}/master/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential: credential.trim() })
  });
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error('RATE_LIMITED');
    }
    throw new Error('Invalid credentials');
  }
  return res.json();
}

export async function sendMasterCommand(
  tokenOrPayload: string | { action: string; [key: string]: any },
  maybePayload?: { action: string; [key: string]: any }
): Promise<any> {
  const explicitToken = typeof tokenOrPayload === 'string' ? tokenOrPayload : undefined;
  const payload = typeof tokenOrPayload === 'string' ? (maybePayload || { action: '' }) : tokenOrPayload;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = explicitToken || getSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/master/command`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearSessionToken();
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error('Failed to execute command');
  }
  return res.json();
}

export interface NotificationChannelConfig {
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  whatsappEnabled: boolean;
  whatsappPhoneNumberId: string;
  whatsappAccessToken: string;
  whatsappRecipientPhone: string;
  notifyOnAmber: boolean;
  cooldownSeconds: number;
}

export async function fetchNotificationConfig(): Promise<NotificationChannelConfig> {
  const res = await authFetch(`${API_BASE}/notifications/config`);
  if (!res.ok) throw new Error('Failed to load notification settings');
  const data = await res.json();
  return data.config;
}

export async function updateNotificationConfig(
  updates: Partial<NotificationChannelConfig>
): Promise<NotificationChannelConfig> {
  const res = await authFetch(`${API_BASE}/notifications/config`, {
    method: 'POST',
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error('Failed to save notification settings');
  const data = await res.json();
  return data.config;
}

export async function detectTelegramChat(
  telegramBotToken: string
): Promise<{ chatId: string; label: string }> {
  const res = await authFetch(`${API_BASE}/notifications/telegram-detect`, {
    method: 'POST',
    body: JSON.stringify({ telegramBotToken })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not detect Telegram chat ID');
  return data;
}

export async function sendTestNotification(
  configOverride?: Partial<NotificationChannelConfig>
): Promise<{ results: Record<string, { ok: boolean; error?: string }> }> {
  const res = await authFetch(`${API_BASE}/notifications/test`, {
    method: 'POST',
    body: JSON.stringify(configOverride || {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed to send test alert');
  return data;
}
