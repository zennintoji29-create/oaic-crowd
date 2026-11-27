import crypto from 'crypto';

const HEARTBEAT_TIMEOUT_MS = 8000;
const ALERT_DEBOUNCE_MS = 1200;

export class HardwareManager {
  constructor() {
    this.operatingMode = 'AI_CAMERA'; // 'AI_CAMERA' | 'HARDWARE_FALLBACK' | 'COMBINED_DEMO'
    this.devices = new Map();         // deviceId -> device record
    this.zoneOverrides = new Map();   // deviceId -> assigned zoneId
    this.deviceSockets = new Map();   // deviceId -> WebSocket
    this.commandSeq = 0;
    this.lastAutoAlertSentAt = 0;
    this.lastSentAlertLevel = 'GREEN';

    this.yoloState = {
      count: 0,
      density: 0,
      score: 0,
      alertLevel: 'GREEN',
      cameraHealthy: false,
      lastUpdated: 0
    };

    this.demoState = {
      active: false,
      alertLevel: null,
      updatedAt: 0
    };

    this.targetCommand = {
      seq: 0,
      nonce: '',
      ts: Date.now(),
      type: 'SYNC_ALERT',
      alertLevel: 'GREEN',
      led: 'GREEN',
      buzzer: 'OFF',
      servoAngle: 90,
      source: 'SYSTEM_INIT'
    };

    this.commandHistory = []; // max 50
    this.eventLogs = [];      // max 80
    this.ackedSeqs = new Set();
    this.fallbackWaiters = [];
    this.onChangeCallback = null;
  }

  setChangeCallback(cb) {
    this.onChangeCallback = cb;
  }

  emitChange(eventType = 'HARDWARE_UPDATE', extra = null) {
    if (this.onChangeCallback) {
      this.onChangeCallback(eventType, extra || this.getSnapshot());
    }
  }

  addEvent(level, event, detail, deviceId = 'system') {
    const entry = {
      id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ts: Date.now(),
      level,
      deviceId,
      event,
      detail
    };
    this.eventLogs.unshift(entry);
    if (this.eventLogs.length > 80) this.eventLogs.pop();
    return entry;
  }

  registerDevice({ deviceId, zoneId = 'zone-entry-a', role = 'MASTER_ACTUATOR', firmwareVersion = '4.0.0', ip = '', capabilities = [] }) {
    const existing = this.devices.get(deviceId);
    const now = Date.now();
    const effectiveZoneId = this.zoneOverrides.get(deviceId) || zoneId || 'zone-entry-a';
    const device = {
      deviceId,
      zoneId: effectiveZoneId,
      role,
      firmwareVersion,
      ip: ip || existing?.ip || '',
      capabilities: capabilities.length > 0 ? capabilities : (existing?.capabilities || []),
      online: true,
      registeredAt: existing?.registeredAt || now,
      lastSeen: now,
      uptimeSec: existing?.uptimeSec || 0,
      wifiRssi: existing?.wifiRssi ?? null,
      sensors: existing?.sensors || {
        presenceDetected: null,
        radarEnergy: null,
        radarOnline: false,
        tofDistanceMm: null,
        tofOnline: false,
        irCount: null
      },
      reportedOutputs: existing?.reportedOutputs || {
        alertLevel: 'SAFE',
        led: 'GREEN',
        buzzer: 'OFF',
        servoAngle: 90,
        lastAckSeq: 0
      }
    };
    this.devices.set(deviceId, device);
    this.addEvent('INFO', 'DEVICE_REGISTERED', `${deviceId} (${role}, fw ${firmwareVersion}) registered on ${zoneId}`, deviceId);
    this.emitChange('HARDWARE_UPDATE');
    return device;
  }

  recordHeartbeat(payload, ip = '') {
    const now = Date.now();
    const { deviceId, zoneId, uptimeSec, wifiRssi, firmwareVersion, sensors, reportedOutputs } = payload;
    let device = this.devices.get(deviceId);
    const wasOffline = !device || !device.online;

    if (!device) {
      device = this.registerDevice({ deviceId, zoneId, firmwareVersion: firmwareVersion || '4.0.0', ip });
    }

    device.online = true;
    device.lastSeen = now;
    if (this.zoneOverrides.has(deviceId)) {
      device.zoneId = this.zoneOverrides.get(deviceId);
    }
    if (ip) device.ip = ip;
    if (typeof uptimeSec === 'number') device.uptimeSec = uptimeSec;
    if (typeof wifiRssi === 'number') device.wifiRssi = wifiRssi;
    if (firmwareVersion) device.firmwareVersion = firmwareVersion;

    if (sensors) {
      device.sensors = {
        presenceDetected: sensors.presenceDetected ?? null,
        radarEnergy: sensors.radarEnergy ?? null,
        radarOnline: Boolean(sensors.radarOnline),
        tofDistanceMm: sensors.tofDistanceMm ?? null,
        tofOnline: Boolean(sensors.tofOnline),
        irCount: sensors.irCount ?? null
      };
    }

    if (reportedOutputs) {
      device.reportedOutputs = {
        ...device.reportedOutputs,
        ...reportedOutputs
      };
    }

    if (wasOffline) {
      this.addEvent('INFO', 'DEVICE_ONLINE', `${deviceId} connected over Wi-Fi (RSSI ${device.wifiRssi ?? 'N/A'} dBm)`, deviceId);
    }

    // Resolve any pending Hardware Fallback activation waiters
    if (device.role === 'MASTER_ACTUATOR' && this.fallbackWaiters.length > 0) {
      const waiters = this.fallbackWaiters.splice(0, this.fallbackWaiters.length);
      waiters.forEach((resolve) => resolve(device));
    }

    this.emitChange('HARDWARE_UPDATE');
    return device;
  }

  assignDeviceZone(deviceId, zoneId) {
    const cleanZone = String(zoneId || 'zone-entry-a').trim();
    const targetId = deviceId || this.getPrimaryMasterDevice()?.deviceId;
    if (!targetId) return null;
    this.zoneOverrides.set(targetId, cleanZone);
    const dev = this.devices.get(targetId);
    if (dev) {
      dev.zoneId = cleanZone;
    }
    this.addEvent('INFO', 'DEVICE_ZONE_ASSIGNED', `Assigned ${targetId} to ${cleanZone}`, targetId);
    this.emitChange('HARDWARE_UPDATE');
    return dev || { deviceId: targetId, zoneId: cleanZone };
  }

  recordAck({ deviceId, seq, command, status, reportedOutputs }) {
    if (this.ackedSeqs.has(`${deviceId}:${seq}`)) {
      return { duplicate: true, seq };
    }
    this.ackedSeqs.add(`${deviceId}:${seq}`);

    const device = this.devices.get(deviceId);
    if (device) {
      device.lastSeen = Date.now();
      device.online = true;
      if (reportedOutputs) {
        device.reportedOutputs = {
          ...device.reportedOutputs,
          ...reportedOutputs,
          lastAckSeq: seq
        };
      } else {
        device.reportedOutputs.lastAckSeq = seq;
      }
    }

    const hist = this.commandHistory.find((c) => c.seq === seq);
    if (hist) {
      hist.status = status;
      hist.ackedAt = Date.now();
    }

    this.addEvent(status === 'APPLIED' ? 'INFO' : 'WARN', 'COMMAND_ACK', `${deviceId} acked seq #${seq} (${command}): ${status}`, deviceId);
    this.emitChange('HARDWARE_ACK', { deviceId, seq, command, status, reportedOutputs });
    this.emitChange('HARDWARE_UPDATE');
    return { duplicate: false, seq, status };
  }

  attachDeviceSocket(deviceId, ws) {
    this.deviceSockets.set(deviceId, ws);
    this.addEvent('INFO', 'WS_DEVICE_CONNECTED', `${deviceId} connected via WebSocket`, deviceId);
    this.pushCommandToSocket(deviceId, this.targetCommand);
  }

  detachDeviceSocket(deviceId) {
    this.deviceSockets.delete(deviceId);
    this.addEvent('WARN', 'WS_DEVICE_DISCONNECTED', `${deviceId} WebSocket closed`, deviceId);
  }

  pushCommandToSocket(deviceId, cmd) {
    const ws = this.deviceSockets.get(deviceId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: 'HARDWARE_COMMAND', data: cmd }));
    }
  }

  issueCommand({ deviceId = 'cpr-esp32-master-01', type, alertLevel, servoAngle, source = 'OPERATOR' }) {
    const seq = ++this.commandSeq;
    const resolvedAlert = alertLevel || this.targetCommand.alertLevel || 'GREEN';
    const resolvedLed = resolvedAlert;
    const resolvedBuzzer =
      type === 'BUZZER_OFF'
        ? 'OFF'
        : resolvedAlert === 'RED'
        ? 'CRITICAL_ALARM'
        : resolvedAlert === 'AMBER'
        ? 'WARNING_BEEPS'
        : 'OFF';

    let resolvedAngle = typeof servoAngle === 'number' ? servoAngle : this.targetCommand.servoAngle;
    if (type === 'GATE_OPEN' || type === 'GATE_RESET') resolvedAngle = 90;
    else if (type === 'GATE_CLOSE') resolvedAngle = 0;
    else if (type === 'GATE_METER') resolvedAngle = 45;
    else if (type === 'SYNC_ALERT' && typeof servoAngle !== 'number') {
      resolvedAngle = resolvedAlert === 'RED' ? 0 : resolvedAlert === 'AMBER' ? 45 : 90;
    }

    const cmd = {
      seq,
      nonce: crypto.randomBytes(6).toString('hex'),
      ts: Date.now(),
      deviceId,
      type,
      alertLevel: resolvedAlert,
      led: resolvedLed,
      buzzer: resolvedBuzzer,
      servoAngle: resolvedAngle,
      source
    };

    this.targetCommand = cmd;
    this.commandHistory.unshift({
      ...cmd,
      status: 'SENT',
      issuedAt: cmd.ts,
      ackedAt: null
    });
    if (this.commandHistory.length > 50) this.commandHistory.pop();

    this.addEvent('INFO', 'COMMAND_ISSUED', `Seq #${seq} [${type}] -> alert=${resolvedAlert}, servo=${resolvedAngle}° (${source})`, deviceId);
    this.pushCommandToSocket(deviceId, cmd);
    for (const [id] of this.deviceSockets.entries()) {
      if (id !== deviceId) this.pushCommandToSocket(id, cmd);
    }
    this.emitChange('HARDWARE_UPDATE');
    return cmd;
  }

  // Called whenever authoritative YOLO telemetry arrives (NEVER overwritten by hardware sensors)
  onYoloTelemetry({ count, density, score, state }) {
    this.yoloState = {
      count,
      density,
      score,
      alertLevel: state,
      cameraHealthy: true,
      lastUpdated: Date.now()
    };

    // Only forward automatic YOLO alerts to ESP32 when not in manual Demo Simulation
    // and when in AI_CAMERA or COMBINED_DEMO mode (with debounce)
    if (!this.demoState.active && (this.operatingMode === 'AI_CAMERA' || this.operatingMode === 'COMBINED_DEMO')) {
      const now = Date.now();
      const changed = state !== this.lastSentAlertLevel;
      if (changed && now - this.lastAutoAlertSentAt >= ALERT_DEBOUNCE_MS) {
        this.lastAutoAlertSentAt = now;
        this.lastSentAlertLevel = state;
        this.issueCommand({
          type: 'SYNC_ALERT',
          alertLevel: state,
          source: 'YOLO_AUTO'
        });
      }
    }
  }

  setDemoSimulation({ action, alertLevel }) {
    if (action === 'RESET') {
      this.demoState = { active: false, alertLevel: null, updatedAt: Date.now() };
      const restoreLevel = this.yoloState.cameraHealthy ? this.yoloState.alertLevel : 'GREEN';
      this.lastSentAlertLevel = restoreLevel;
      const cmd = this.issueCommand({
        type: 'SYNC_ALERT',
        alertLevel: restoreLevel,
        source: 'DEMO_RESET_TO_LIVE'
      });
      this.addEvent('INFO', 'DEMO_RESET', `Demo reset; restored live state (${restoreLevel})`);
      this.emitChange('HARDWARE_UPDATE');
      return { demoState: this.demoState, command: cmd };
    }

    const level = alertLevel || 'GREEN';
    this.demoState = { active: true, alertLevel: level, updatedAt: Date.now() };
    this.lastSentAlertLevel = level;
    const cmd = this.issueCommand({
      type: 'SYNC_ALERT',
      alertLevel: level,
      source: 'MANUAL_DEMO_SIMULATION'
    });
    this.addEvent('WARN', 'DEMO_SIMULATION', `Manual Demo Simulation set to ${level}`);
    this.emitChange('HARDWARE_UPDATE');
    return { demoState: this.demoState, command: cmd };
  }

  async setOperatingMode(mode) {
    if (mode === 'AI_CAMERA' || mode === 'COMBINED_DEMO') {
      this.operatingMode = mode;
      this.addEvent('INFO', 'MODE_CHANGED', `Operating mode switched to ${mode}`);
      if (mode === 'COMBINED_DEMO' && !this.demoState.active) {
        this.issueCommand({
          type: 'SYNC_ALERT',
          alertLevel: this.yoloState.alertLevel || 'GREEN',
          source: 'COMBINED_MODE_SYNC'
        });
      }
      this.emitChange('HARDWARE_UPDATE');
      return { ok: true, mode: this.operatingMode };
    }

    // HARDWARE_FALLBACK: require real online master ESP32 + valid recent telemetry
    const master = this.getPrimaryMasterDevice();
    const now = Date.now();
    if (master && master.online && now - master.lastSeen <= HEARTBEAT_TIMEOUT_MS) {
      this.operatingMode = 'HARDWARE_FALLBACK';
      this.addEvent('INFO', 'MODE_CHANGED', `Hardware Fallback activated (${master.deviceId} validated)`, master.deviceId);
      this.emitChange('HARDWARE_UPDATE');
      return { ok: true, mode: this.operatingMode, device: master };
    }

    // Wait up to 3.5 seconds for a live ESP32 heartbeat/telemetry packet (no fake delay)
    const connectedDevice = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        const idx = this.fallbackWaiters.indexOf(onDevice);
        if (idx >= 0) this.fallbackWaiters.splice(idx, 1);
        resolve(null);
      }, 3500);

      const onDevice = (dev) => {
        clearTimeout(timer);
        resolve(dev);
      };
      this.fallbackWaiters.push(onDevice);
    });

    if (!connectedDevice) {
      this.addEvent('ERROR', 'FALLBACK_FAILED', 'Hardware Fallback failed: no ESP32 telemetry received within 3.5s');
      this.emitChange('HARDWARE_UPDATE');
      return {
        ok: false,
        error: 'ESP32 did not respond with valid telemetry within 3.5s. Check Wi-Fi and device power.'
      };
    }

    this.operatingMode = 'HARDWARE_FALLBACK';
    this.addEvent('INFO', 'MODE_CHANGED', `Hardware Fallback activated after live handshake (${connectedDevice.deviceId})`, connectedDevice.deviceId);
    this.emitChange('HARDWARE_UPDATE');
    return { ok: true, mode: this.operatingMode, device: connectedDevice };
  }

  checkTimeouts() {
    const now = Date.now();
    let changed = false;

    for (const device of this.devices.values()) {
      if (device.online && now - device.lastSeen > HEARTBEAT_TIMEOUT_MS) {
        device.online = false;
        device.sensors = {
          presenceDetected: null,
          radarEnergy: null,
          radarOnline: false,
          tofDistanceMm: null,
          tofOnline: false,
          irCount: null
        };
        this.addEvent('ERROR', 'DEVICE_TIMEOUT', `${device.deviceId} heartbeat timed out (>8s)`, device.deviceId);
        changed = true;
      }
    }

    if (this.yoloState.cameraHealthy && now - this.yoloState.lastUpdated > 5000) {
      this.yoloState.cameraHealthy = false;
      changed = true;
    }

    const staleResetMs = parseInt(process.env.TELEMETRY_STALE_CLEAR_MS || '60000', 10);
    if (
      !this.demoState.active &&
      this.yoloState.lastUpdated > 0 &&
      (this.yoloState.count > 0 || this.yoloState.score > 0 || this.yoloState.alertLevel !== 'GREEN') &&
      now - this.yoloState.lastUpdated >= staleResetMs
    ) {
      this.yoloState = {
        count: 0,
        density: 0,
        score: 0,
        alertLevel: 'GREEN',
        cameraHealthy: false,
        lastUpdated: 0
      };
      this.lastSentAlertLevel = 'GREEN';
      this.addEvent('INFO', 'YOLO_STALE_CLEARED', `No camera/USB telemetry for ${Math.round(staleResetMs / 1000)}s — cleared stale count to 0`);
      changed = true;
    }

    // Auto-return to AI_CAMERA if hardware disconnects while camera is healthy
    const master = this.getPrimaryMasterDevice();
    if (this.operatingMode === 'HARDWARE_FALLBACK' && (!master || !master.online) && this.yoloState.cameraHealthy) {
      this.operatingMode = 'AI_CAMERA';
      this.addEvent('WARN', 'FALLBACK_REVERTED', 'ESP32 disconnected; automatically returned to AI Camera Mode');
      changed = true;
    }

    if (changed) {
      this.emitChange('HARDWARE_UPDATE');
    }
  }

  getPrimaryMasterDevice() {
    for (const d of this.devices.values()) {
      if (d.role === 'MASTER_ACTUATOR') return d;
    }
    return Array.from(this.devices.values())[0] || null;
  }

  getSnapshot() {
    const master = this.getPrimaryMasterDevice();
    const now = Date.now();
    return {
      operatingMode: this.operatingMode,
      yoloState: { ...this.yoloState },
      demoState: { ...this.demoState },
      esp32Connected: Boolean(master && master.online && now - master.lastSeen <= HEARTBEAT_TIMEOUT_MS),
      primaryDevice: master ? { ...master } : null,
      devices: Array.from(this.devices.values()),
      targetCommand: { ...this.targetCommand },
      commandHistory: this.commandHistory.slice(0, 20),
      eventLogs: this.eventLogs.slice(0, 30)
    };
  }
}

export const hardwareManager = new HardwareManager();
