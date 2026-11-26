export type CrowdState = 'GREEN' | 'AMBER' | 'RED' | 'OFFLINE';

export interface TelemetryPoint {
  deviceId: string;
  zoneId: string;
  timestamp: number;
  serverTimestamp: number;
  state: 'GREEN' | 'AMBER' | 'RED';
  score: number;
  density: number;
  avgSpeed: number;
  stopGoIndex: number;
  targetCount: number;
  entryCount: number;
  exitCount: number;
  activeAlerts: string[];
  firmwareVersion?: string;
}

export interface ZoneInfo {
  zoneId: string;
  name: string;
  areaSqM: number;
  corridorWidthM: number;
  deviceId: string;
  currentStatus: CrowdState;
  score: number;
  density: number;
  avgSpeed: number;
  lastSeenMsAgo: number | null;
  lastTelemetry: TelemetryPoint | null;
}

export interface AlertRecord {
  id: string;
  timestamp: number;
  zoneId: string;
  zoneName: string;
  fromState: string;
  toState: string;
  score: number;
  density?: number;
  avgSpeed?: number;
  message: string;
  acknowledged?: boolean;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  ackNote?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  actorEmail: string;
  action: string;
  target: string;
  detail: string;
}

export interface OperatorProfile {
  email: string;
  phone: string;
  displayName?: string;
  setupComplete: boolean;
  createdAt: number | null;
}

export type OperatorCommand = 'MANUAL_GATE_OPEN' | 'MANUAL_GATE_CLOSE' | 'SILENCE_BUZZER' | 'RESET_ZONE';

export interface HardwareActuatorState {
  systemMode: 'AI_VISION_PRIMARY' | 'HARDWARE_FAILOVER';
  cameraOnline: boolean;
  lastCameraPing: number;
  currentCount: number;
  radarEnergy: number;
  tofDistanceMm: number;
  ledState: { red: boolean; yellow: boolean; green: boolean };
  rgb: { r: number; g: number; b: number };
  ledPins: { red: number; yellow: number; green: number };
  servoAngle: number;
  servoStatus: string;
  buzzer: boolean;
  oled: {
    line1: string;
    line2: string;
    line3: string;
    line4: string;
  };
}

export interface KeepAliveStats {
  enabled: boolean;
  targetUrl: string | null;
  intervalMinutes: number;
  totalPings: number;
  successfulPings: number;
  failedPings: number;
  lastPingAt: string | null;
  lastPingStatus: string;
  lastLatencyMs: number;
}

export interface GateState {
  id: string;              // 'gate-a', 'gate-b'
  name: string;            // 'Main Temple Gate A', 'North Pavilion Gate B'
  zoneId: string;          // 'zone-entry-a', 'zone-corridor-b'
  status: CrowdState;      // 'GREEN' | 'AMBER' | 'RED' | 'OFFLINE'
  count: number;
  density: number;
  riskScore: number;
  servoAngle: number;      // 0, 45, 90
  servoStatus: string;     // 'OPEN', 'METERED (PARTIAL)', 'CLOSED (LOCKED)'
  isManualOverride: boolean;
  manualState: 'AUTO' | 'FORCE_OPEN' | 'FORCE_METER' | 'FORCE_LOCK';
  power: boolean;          // Gate active / offline
  lastUpdated: number;
  amberThreshold: number;  // Default 5
  redThreshold: number;    // Default 10
  cameraStreamUrl?: string;
}

export interface SystemConfig {
  gateName: string;
  gateId: string;
  cameraStreamUrl?: string;
  passcode?: string;
  autoFailover: boolean;
  buzzerAlerts: boolean;
  amberThreshold: number;
  redThreshold: number;
  configuredAt: number;
  isConfigured: boolean;
}

export interface TrafficAnalytics {
  peakHours: { hour: string; count: number; risk: number }[];
  modeSummary: {
    aiVisionHours: number;
    failoverHours: number;
    totalUptimeHours: number;
    failoverEventsCount: number;
    autoRecoveryRatePercent: number;
  };
  riskTimeline: { time: string; state: string; count: number; event: string }[];
  gateBreakdown: { gateId: string; name: string; totalPassages: number; criticalIncidents: number }[];
}

export type OperatingMode = 'AI_CAMERA' | 'HARDWARE_FALLBACK' | 'COMBINED_DEMO';

export interface Esp32DeviceRecord {
  deviceId: string;
  zoneId: string;
  role: 'MASTER_ACTUATOR' | 'TRANSMITTER_SENSOR';
  firmwareVersion: string;
  ip: string;
  capabilities: string[];
  online: boolean;
  registeredAt: number;
  lastSeen: number;
  uptimeSec: number;
  wifiRssi: number | null;
  sensors: {
    presenceDetected: boolean | null;
    radarEnergy: number | null;
    radarOnline: boolean;
    tofDistanceMm: number | null;
    tofOnline: boolean;
    irCount: number | null;
  };
  reportedOutputs: {
    alertLevel: 'GREEN' | 'AMBER' | 'RED' | 'SAFE';
    led: 'GREEN' | 'AMBER' | 'RED' | 'SAFE';
    buzzer: 'OFF' | 'WARNING_BEEPS' | 'CRITICAL_ALARM';
    servoAngle: number;
    lastAckSeq: number;
  };
}

export interface HardwareManagerSnapshot {
  operatingMode: OperatingMode;
  yoloState: {
    count: number;
    density: number;
    score: number;
    alertLevel: 'GREEN' | 'AMBER' | 'RED';
    cameraHealthy: boolean;
    lastUpdated: number;
  };
  demoState: {
    active: boolean;
    alertLevel: 'GREEN' | 'AMBER' | 'RED' | null;
    updatedAt: number;
  };
  esp32Connected: boolean;
  primaryDevice: Esp32DeviceRecord | null;
  devices: Esp32DeviceRecord[];
  targetCommand: {
    seq: number;
    nonce: string;
    ts: number;
    type: string;
    alertLevel: 'GREEN' | 'AMBER' | 'RED';
    led: string;
    buzzer: string;
    servoAngle: number;
    source: string;
  };
  commandHistory: {
    seq: number;
    type: string;
    alertLevel: string;
    servoAngle: number;
    buzzer: string;
    source: string;
    status: string;
    issuedAt: number;
    ackedAt: number | null;
  }[];
  eventLogs: {
    id: string;
    ts: number;
    level: string;
    deviceId: string;
    event: string;
    detail: string;
  }[];
}




