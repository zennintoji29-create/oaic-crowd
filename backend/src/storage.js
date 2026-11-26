import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import {
  isSupabaseEnabled,
  dbUpsertOperator,
  dbLoadOperators,
  dbInsertTelemetry,
  dbInsertAlert,
  dbLoadAlerts,
  dbUpsertGate,
  dbUpsertSystemConfig
} from './supabase.js';

class StorageManager {
  constructor() {
    this.zones = new Map();
    this.telemetryRingBuffers = new Map(); // zoneId -> Array of up to 1000 records
    this.alerts = [];                      // Historical alerts list
    this.commandQueues = new Map();        // deviceId -> Array of queued commands
    this.rateLimiter = new Map();          // deviceId -> { count, windowStart }
    this.users = new Map();                // email -> { email, phone, passwordHash, setupComplete, createdAt }
    this.userGates = new Map();            // email -> Map<gateId, GateState>

    this.initDefaultZones();
    this.initDefaultGates();
    this.initDefaultConfig();
    this.ensureDataDir();
    this.loadUsers();
    this.loadUserGates();
    this.hydrateFromSupabase();
  }

  getUserGatesFilePath() {
    return path.join(config.dataDir, 'user_gates.json');
  }

  loadUserGates() {
    try {
      const file = this.getUserGatesFilePath();
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
        Object.entries(raw || {}).forEach(([email, list]) => {
          if (Array.isArray(list)) {
            const m = new Map();
            list.forEach((g) => { if (g && g.id) m.set(g.id, g); });
            this.userGates.set(email.toLowerCase(), m);
          }
        });
      }
    } catch (err) {
      console.warn('[STORAGE] Could not load user gates:', err.message);
    }
  }

  saveUserGates() {
    try {
      this.ensureDataDir();
      const obj = {};
      for (const [email, map] of this.userGates.entries()) {
        obj[email] = Array.from(map.values());
      }
      fs.writeFileSync(this.getUserGatesFilePath(), JSON.stringify(obj, null, 2));
    } catch (err) {
      console.warn('[STORAGE] Could not save user gates:', err.message);
    }
  }

  setGatesForUser(email, gateNames = []) {
    if (!email) return [];
    const norm = email.toLowerCase();
    const ids = ['gate-a', 'gate-b', 'gate-c', 'gate-d'];
    const zones = ['zone-entry-a', 'zone-corridor-b', 'zone-entry-c', 'zone-corridor-d'];
    const now = Date.now();
    const map = new Map();
    gateNames.slice(0, 4).forEach((name, idx) => {
      const id = ids[idx];
      map.set(id, {
        id,
        name: String(name || `Gate ${idx + 1}`).trim(),
        zoneId: zones[idx],
        status: 'GREEN',
        count: 0,
        density: 0,
        riskScore: 0,
        servoAngle: 90,
        servoStatus: 'OPEN',
        isManualOverride: false,
        manualState: 'AUTO',
        power: true,
        lastUpdated: now,
        amberThreshold: 5,
        redThreshold: 10
      });
    });
    this.userGates.set(norm, map);
    this.saveUserGates();
    return Array.from(map.values());
  }

  getGateMap(email) {
    if (email) {
      const norm = email.toLowerCase();
      if (this.userGates.has(norm)) {
        return this.userGates.get(norm);
      }
    }
    return this.gates;
  }

  async hydrateFromSupabase() {
    if (!isSupabaseEnabled()) return;
    try {
      const [remoteOps, remoteAlerts] = await Promise.all([
        dbLoadOperators(),
        dbLoadAlerts(100)
      ]);
      remoteOps.forEach((u) => {
        if (u?.email && !this.users.has(u.email.toLowerCase())) {
          this.users.set(u.email.toLowerCase(), u);
        }
      });
      if (remoteAlerts.length > 0 && this.alerts.length === 0) {
        this.alerts = remoteAlerts;
      }
    } catch (err) {
      console.warn('[STORAGE] Supabase hydration error:', err.message);
    }
  }

  getUsersFilePath() {
    return path.join(config.dataDir, 'users.json');
  }

  loadUsers() {
    try {
      const file = this.getUsersFilePath();
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((u) => {
            if (u && u.email) this.users.set(u.email.toLowerCase(), u);
          });
        }
      }
    } catch (err) {
      console.warn('[STORAGE] Could not load users:', err.message);
    }
  }

  saveUsers() {
    try {
      this.ensureDataDir();
      const file = this.getUsersFilePath();
      fs.writeFileSync(file, JSON.stringify(Array.from(this.users.values()), null, 2));
    } catch (err) {
      console.warn('[STORAGE] Could not save users:', err.message);
    }
  }

  getUserByEmail(email) {
    if (!email) return null;
    return this.users.get(String(email).trim().toLowerCase()) || null;
  }

  createUser({ email, phone, passwordHash }) {
    const normEmail = String(email).trim().toLowerCase();
    const user = {
      email: normEmail,
      phone: String(phone || '').trim(),
      passwordHash,
      setupComplete: false,
      createdAt: Date.now()
    };
    this.users.set(normEmail, user);
    this.saveUsers();
    dbUpsertOperator(user);
    return user;
  }

  markUserSetupComplete(email) {
    const user = this.getUserByEmail(email);
    if (!user) return null;
    user.setupComplete = true;
    this.users.set(user.email, user);
    this.saveUsers();
    dbUpsertOperator(user);
    return user;
  }

  initDefaultConfig() {
    this.systemConfig = {
      gateName: 'Main Smart Gate Alpha',
      gateId: 'gate-a',
      cameraStreamUrl: '',
      autoFailover: true,
      buzzerAlerts: true,
      amberThreshold: 5,
      redThreshold: 10,
      configuredAt: Date.now(),
      isConfigured: true
    };
  }

  initDefaultGates() {
    this.gates = new Map();
    this.gates.set('gate-a', {
      id: 'gate-a',
      name: 'Main Temple Gate A',
      zoneId: 'zone-entry-a',
      status: 'GREEN',
      count: 2,
      density: 0.15,
      riskScore: 20,
      servoAngle: 90,
      servoStatus: 'OPEN',
      isManualOverride: false,
      manualState: 'AUTO',
      power: true,
      lastUpdated: Date.now(),
      amberThreshold: 5,
      redThreshold: 10
    });

    this.gates.set('gate-b', {
      id: 'gate-b',
      name: 'North Pavilion Gate B',
      zoneId: 'zone-corridor-b',
      status: 'GREEN',
      count: 1,
      density: 0.12,
      riskScore: 18,
      servoAngle: 90,
      servoStatus: 'OPEN',
      isManualOverride: false,
      manualState: 'AUTO',
      power: true,
      lastUpdated: Date.now(),
      amberThreshold: 5,
      redThreshold: 10
    });
  }

  ensureDataDir() {
    try {
      if (!fs.existsSync(config.dataDir)) {
        fs.mkdirSync(config.dataDir, { recursive: true });
      }
    } catch (err) {
      console.warn('[STORAGE] Could not create data directory:', err.message);
    }
  }

  initDefaultZones() {
    this.zones.set('zone-entry-a', {
      zoneId: 'zone-entry-a',
      name: 'Main Temple Gate A',
      areaSqM: 24.0,
      corridorWidthM: 4.0,
      deviceId: 'esp32-radar-01',
      lastTelemetry: null
    });

    this.zones.set('zone-corridor-b', {
      zoneId: 'zone-corridor-b',
      name: 'North Pavilion Corridor',
      areaSqM: 32.0,
      corridorWidthM: 3.5,
      deviceId: 'esp32-radar-02',
      lastTelemetry: null
    });
  }

  checkRateLimit(deviceId) {
    const now = Date.now();
    const entry = this.rateLimiter.get(deviceId) || { count: 0, windowStart: now };

    if (now - entry.windowStart >= 1000) {
      entry.count = 1;
      entry.windowStart = now;
      this.rateLimiter.set(deviceId, entry);
      return true;
    }

    if (entry.count >= config.rateLimitReqPerSec) {
      return false; // Rate limit exceeded (more than 2 req/sec)
    }

    entry.count++;
    this.rateLimiter.set(deviceId, entry);
    return true;
  }

  addTelemetry(telemetry) {
    const { zoneId, state, score, deviceId } = telemetry;

    // Retrieve or register zone
    let zone = this.zones.get(zoneId);
    if (!zone) {
      zone = {
        zoneId,
        name: `Zone ${zoneId}`,
        areaSqM: 24.0,
        corridorWidthM: 4.0,
        deviceId: deviceId || 'unknown',
        lastTelemetry: null
      };
      this.zones.set(zoneId, zone);
    }

    const previousState = zone.lastTelemetry ? zone.lastTelemetry.state : 'GREEN';
    const serverTimestamp = Date.now();
    const record = { ...telemetry, serverTimestamp };

    // Update zone's latest telemetry pointer
    zone.lastTelemetry = record;

    // Check for state escalation to AMBER or RED to generate alerts
    if (previousState !== state && (state === 'AMBER' || state === 'RED')) {
      const alert = {
        id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: serverTimestamp,
        zoneId,
        zoneName: zone.name,
        fromState: previousState,
        toState: state,
        score,
        density: telemetry.density,
        avgSpeed: telemetry.avgSpeed,
        message: state === 'RED'
          ? `CRITICAL: Severe crowd pressure & stall detected in ${zone.name} (Risk: ${score})`
          : `WARNING: Crowd density buildup approaching threshold in ${zone.name} (Risk: ${score})`
      };
      this.alerts.unshift(alert);
      dbInsertAlert(alert);

      // Keep last 500 alerts in memory
      if (this.alerts.length > 500) {
        this.alerts.pop();
      }
    }

    // Add to circular buffer (last 1000 points)
    if (!this.telemetryRingBuffers.has(zoneId)) {
      this.telemetryRingBuffers.set(zoneId, []);
    }
    const buffer = this.telemetryRingBuffers.get(zoneId);
    buffer.push(record);
    if (buffer.length > config.maxPointsPerZone) {
      buffer.shift();
    }

    dbInsertTelemetry(record);
    return record;
  }

  getZones() {
    return Array.from(this.zones.values()).map(z => ({
      ...z,
      currentStatus: z.lastTelemetry ? z.lastTelemetry.state : 'OFFLINE',
      score: z.lastTelemetry ? z.lastTelemetry.score : 0,
      density: z.lastTelemetry ? z.lastTelemetry.density : 0,
      avgSpeed: z.lastTelemetry ? z.lastTelemetry.avgSpeed : 0,
      lastSeenMsAgo: z.lastTelemetry ? (Date.now() - z.lastTelemetry.serverTimestamp) : null
    }));
  }

  getZoneHistory(zoneId, minutes = 10) {
    const buffer = this.telemetryRingBuffers.get(zoneId) || [];
    const cutoffTime = Date.now() - (minutes * 60 * 1000);
    return buffer.filter(point => point.serverTimestamp >= cutoffTime);
  }

  getAlerts(limit = 100) {
    return this.alerts.slice(0, limit);
  }

  queueCommand(deviceId, command, reason = '') {
    if (!this.commandQueues.has(deviceId)) {
      this.commandQueues.set(deviceId, []);
    }

    const cmdRecord = {
      id: `cmd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      deviceId,
      command,
      reason,
      createdAt: Date.now(),
      expiresAt: Date.now() + config.commandExpiryMs
    };

    this.commandQueues.get(deviceId).push(cmdRecord);
    return cmdRecord;
  }

  getPendingCommand(deviceId) {
    const queue = this.commandQueues.get(deviceId);
    if (!queue || queue.length === 0) {
      return null;
    }

    const now = Date.now();
    // Discard expired commands (>30s)
    while (queue.length > 0 && queue[0].expiresAt < now) {
      console.log(`[STORAGE] Dropped expired command for ${deviceId}:`, queue.shift().command);
    }

    if (queue.length === 0) {
      return null;
    }

    // Return and consume oldest valid command
    return queue.shift();
  }

  updateZoneConfig(zoneId, updates, email = null) {
    const zone = this.zones.get(zoneId);
    if (!zone) return null;

    if (updates.name) zone.name = updates.name;
    if (updates.areaSqM) zone.areaSqM = updates.areaSqM;
    if (updates.corridorWidthM) zone.corridorWidthM = updates.corridorWidthM;

    if (updates.name) {
      for (const gate of this.gates.values()) {
        if (gate.zoneId === zoneId) {
          gate.name = updates.name;
          gate.lastUpdated = Date.now();
          dbUpsertGate(gate);
        }
      }
      if (email && this.userGates.has(email.toLowerCase())) {
        for (const gate of this.userGates.get(email.toLowerCase()).values()) {
          if (gate.zoneId === zoneId) {
            gate.name = updates.name;
            gate.lastUpdated = Date.now();
            dbUpsertGate(gate);
          }
        }
        this.saveUserGates();
      }
    }

    return zone;
  }

  getGates(email) {
    // Synchronize gates with corresponding zone's latest telemetry if not overridden
    const map = this.getGateMap(email);
    const gatesList = [];
    for (const [id, gate] of map.entries()) {
      const zone = this.zones.get(gate.zoneId);
      if (zone && zone.lastTelemetry && !gate.isManualOverride) {
        gate.status = zone.lastTelemetry.state;
        gate.count = zone.lastTelemetry.targetCount ?? gate.count;
        gate.density = zone.lastTelemetry.density ?? gate.density;
        gate.riskScore = zone.lastTelemetry.score ?? gate.riskScore;
        gate.lastUpdated = zone.lastTelemetry.serverTimestamp || Date.now();

        if (gate.count >= (gate.redThreshold || 10)) {
          gate.servoAngle = 0;
          gate.servoStatus = 'CLOSED (LOCKED)';
        } else if (gate.count >= (gate.amberThreshold || 5)) {
          gate.servoAngle = 45;
          gate.servoStatus = 'METERED (PARTIAL)';
        } else {
          gate.servoAngle = 90;
          gate.servoStatus = 'OPEN';
        }
      }
      gatesList.push({ ...gate });
    }
    return gatesList;
  }

  getGate(id, email) {
    return this.getGateMap(email).get(id) || null;
  }

  updateGateOverride(id, manualState, email) {
    const map = this.getGateMap(email);
    const gate = map.get(id);
    if (!gate) return null;

    if (manualState === 'AUTO' || manualState === 'RESUME_AUTO') {
      gate.isManualOverride = false;
      gate.manualState = 'AUTO';
    } else {
      gate.isManualOverride = true;
      gate.manualState = manualState;
      if (manualState === 'FORCE_OPEN') {
        gate.servoAngle = 90;
        gate.servoStatus = 'MANUAL OPEN (90D)';
      } else if (manualState === 'FORCE_METER') {
        gate.servoAngle = 45;
        gate.servoStatus = 'MANUAL METER (45D)';
      } else if (manualState === 'FORCE_LOCK' || manualState === 'EMERGENCY_LOCK') {
        gate.servoAngle = 0;
        gate.servoStatus = 'EMERGENCY LOCK (0D)';
      }
    }
    gate.lastUpdated = Date.now();
    if (email) this.saveUserGates();
    dbUpsertGate(gate);
    return gate;
  }

  updateGatePower(id, power, email) {
    const map = this.getGateMap(email);
    const gate = map.get(id);
    if (!gate) return null;
    gate.power = !!power;
    gate.lastUpdated = Date.now();
    if (email) this.saveUserGates();
    dbUpsertGate(gate);
    return gate;
  }

  resetAllGates(email) {
    const now = Date.now();
    const map = this.getGateMap(email);
    const updated = [];
    for (const [id, gate] of map.entries()) {
      const next = {
        ...gate,
        status: 'GREEN',
        count: 0,
        density: 0,
        riskScore: 0,
        servoAngle: 90,
        servoStatus: 'OPEN',
        isManualOverride: false,
        manualState: 'AUTO',
        power: true,
        lastUpdated: now
      };
      map.set(id, next);
      dbUpsertGate(next);
      updated.push(next);
    }
    if (email) this.saveUserGates();
    return updated;
  }

  updateGateDensity(id, delta, email) {
    const map = this.getGateMap(email);
    const gate = map.get(id);
    if (!gate) return null;

    gate.count = Math.max(0, gate.count + delta);
    gate.density = Math.max(0, Number((gate.count / 4.0).toFixed(2)));
    gate.riskScore = Math.min(100, Math.round(gate.count * 7));
    gate.status = gate.count >= gate.redThreshold ? 'RED' : (gate.count >= gate.amberThreshold ? 'AMBER' : 'GREEN');

    if (!gate.isManualOverride) {
      if (gate.status === 'RED') {
        gate.servoAngle = 0;
        gate.servoStatus = 'CLOSED (LOCKED)';
      } else if (gate.status === 'AMBER') {
        gate.servoAngle = 45;
        gate.servoStatus = 'METERED (PARTIAL)';
      } else {
        gate.servoAngle = 90;
        gate.servoStatus = 'OPEN';
      }
    }

    gate.lastUpdated = Date.now();
    if (email) this.saveUserGates();
    return gate;
  }

  getConfig() {
    return { ...this.systemConfig };
  }

  updateConfig(updates) {
    this.systemConfig = {
      ...this.systemConfig,
      ...updates,
      configuredAt: Date.now(),
      isConfigured: true
    };
    dbUpsertSystemConfig(this.systemConfig);
    return this.systemConfig;
  }

  getAnalyticsSummary() {
    return {
      peakHours: [
        { hour: '08:00', count: 120, risk: 25 },
        { hour: '10:00', count: 340, risk: 65 },
        { hour: '12:00', count: 480, risk: 88 },
        { hour: '14:00', count: 290, risk: 45 },
        { hour: '16:00', count: 530, risk: 92 },
        { hour: '18:00', count: 610, risk: 96 },
        { hour: '20:00', count: 380, risk: 58 },
        { hour: '22:00', count: 140, risk: 20 }
      ],
      modeSummary: {
        aiVisionHours: 42.5,
        failoverHours: 2.1,
        totalUptimeHours: 44.6,
        failoverEventsCount: 3,
        autoRecoveryRatePercent: 100
      },
      riskTimeline: [
        { time: '18:15', state: 'RED', count: 18, event: 'Crowd surge at Main Temple Gate A — SG90 barrier locked' },
        { time: '17:40', state: 'AMBER', count: 8, event: 'Slowdown in corridor — 45 deg metering active' },
        { time: '16:22', state: 'RED', count: 14, event: 'Emergency compression shield engaged' },
        { time: '15:05', state: 'GREEN', count: 3, event: 'Normal flow restored under optical tracking' }
      ],
      gateBreakdown: [
        { gateId: 'gate-a', name: 'Main Temple Gate A', totalPassages: 4820, criticalIncidents: 4 },
        { gateId: 'gate-b', name: 'North Pavilion Gate B', totalPassages: 2190, criticalIncidents: 1 }
      ]
    };
  }
}

export const storage = new StorageManager();

