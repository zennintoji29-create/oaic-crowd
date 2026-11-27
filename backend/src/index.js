import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from './config.js';
import {
  TelemetrySchema,
  CommandSchema,
  ZoneConfigSchema,
  HardwareRegisterSchema,
  HardwareHeartbeatSchema,
  HardwareAckSchema,
  HardwareModeSchema,
  HardwareDemoSchema,
  HardwareCommandSchema
} from './schema.js';
import { storage } from './storage.js';
import { simulator } from './simulator.js';
import { keepAliveEngine } from './keepAlive.js';
import { hardwareManager } from './hardwareManager.js';
import { notifier } from './notifier.js';

const app = express();
app.set('trust proxy', 1); // Respect Render / reverse-proxy X-Forwarded-For for accurate rate limiting
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// CORS Configuration - Restricted to Vercel deployment (and localhost in non-production)
const allowedOrigins = new Set([
  'https://oaic-crowd.vercel.app',
  ...(config.corsOrigin && config.corsOrigin !== '*' ? config.corsOrigin.split(',').map(o => o.trim()) : [])
]);
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.add('http://localhost:5173');
  allowedOrigins.add('http://127.0.0.1:5173');
}

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '100kb' }));

// Global baseline IP rate limiter to mitigate API flooding / DoS
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});
app.use('/api', apiLimiter);

// ----------------------------------------------------------------------------
// Central Hardware & Actuator State (ESP32 Master & Failover)
// ----------------------------------------------------------------------------
const hardwareState = {
  systemMode: 'AI_VISION_PRIMARY',
  cameraOnline: true,
  lastCameraPing: Date.now(),
  currentCount: 0,
  radarEnergy: 25,
  tofDistanceMm: 1850,
  ledState: { red: false, yellow: false, green: true },
  rgb: { r: 0, g: 255, b: 0 },
  servoAngle: 90,
  servoStatus: 'OPEN',
  buzzer: false,
  oled: {
    line1: 'CPR CROWD RADAR',
    line2: 'COUNT: 0 PPL',
    line3: 'STATUS: NORMAL',
    line4: 'GATE: OPEN (90D)'
  }
};

// Evaluates Traffic Light LEDs, SG90 Gate & OLED text from authoritative YOLO count
// Note: Hardware presence/ToF NEVER overwrites YOLO person count or density.
function updateControlLogic(overrideCount) {
  const count = typeof overrideCount === 'number' ? overrideCount : hardwareState.currentCount;
  hardwareState.currentCount = count;

  // Threshold Rules:
  // < 5 people   -> GREEN LED, Gate 90° (Open)
  // 5 - 9 people -> YELLOW/AMBER LED, Gate 45° (Metered)
  // >= 10 people -> RED LED, Gate 0° (Locked), Buzzer Alarm ON
  if (count >= 10) {
    hardwareState.ledState = { red: true, yellow: false, green: false };
    hardwareState.rgb = { r: 255, g: 0, b: 0 };
    hardwareState.servoAngle = 0;
    hardwareState.servoStatus = 'CLOSED (LOCKED)';
    hardwareState.buzzer = true;
    hardwareState.oled = {
      line1: hardwareState.systemMode === 'HARDWARE_FAILOVER' ? 'FAILOVER: RED' : 'CPR: RED ALERT!',
      line2: `COUNT: ${count} PPL`,
      line3: 'STATUS: CRITICAL',
      line4: 'GATE: LOCKED (0D)'
    };
  } else if (count >= 5) {
    hardwareState.ledState = { red: false, yellow: true, green: false };
    hardwareState.rgb = { r: 255, g: 180, b: 0 };
    hardwareState.servoAngle = 45;
    hardwareState.servoStatus = 'METERED (PARTIAL)';
    hardwareState.buzzer = false;
    hardwareState.oled = {
      line1: hardwareState.systemMode === 'HARDWARE_FAILOVER' ? 'FAILOVER: WARN' : 'CPR: WARNING',
      line2: `COUNT: ${count} PPL`,
      line3: 'STATUS: ELEVATED',
      line4: 'GATE: METER (45D)'
    };
  } else {
    hardwareState.ledState = { red: false, yellow: false, green: true };
    hardwareState.rgb = { r: 0, g: 255, b: 0 };
    hardwareState.servoAngle = 90;
    hardwareState.servoStatus = 'OPEN';
    hardwareState.buzzer = false;
    hardwareState.oled = {
      line1: hardwareState.systemMode === 'HARDWARE_FAILOVER' ? 'FAILOVER: OK' : 'CPR RADAR: LIVE',
      line2: `COUNT: ${count} PPL`,
      line3: 'STATUS: NORMAL',
      line4: 'GATE: OPEN (90D)'
    };
  }

  broadcast('HARDWARE_UPDATE', hardwareState);
  broadcastSSE({ type: 'HARDWARE_UPDATE', state: hardwareState });
}

// Watchdog: check ESP32 heartbeat timeouts, camera health, and clear stale telemetry (>2m idle)
setInterval(() => {
  hardwareManager.checkTimeouts();

  const { clearedZones, clearedGates } = storage.clearStaleTelemetry(config.staleTelemetryResetMs);
  if (clearedZones.length > 0 || clearedGates.length > 0) {
    if (!hardwareState.lastCameraPing || Date.now() - hardwareState.lastCameraPing >= config.staleTelemetryResetMs) {
      hardwareState.cameraOnline = false;
      hardwareState.currentCount = 0;
      updateControlLogic(0);
    }
    clearedGates.forEach(({ gate }) => {
      broadcast('GATE_UPDATED', gate);
    });
    if (clearedZones.length > 0) {
      broadcast('ZONES_SYNCED', storage.getZones());
    }
    const auditStale = storage.addAuditLog({
      actorEmail: 'system-watchdog',
      action: 'STALE_DATA_CLEARED',
      target: clearedZones[0] || clearedGates[0]?.gate?.id || 'telemetry',
      detail: `Cleared stale telemetry to 0 after ${Math.round(config.staleTelemetryResetMs / 1000)}s without live camera/USB updates`
    });
    broadcast('AUDIT_UPDATED', auditStale);
  }
}, 2000);

hardwareManager.setChangeCallback((eventType, payload) => {
  if (eventType === 'HARDWARE_ACK') {
    broadcast('HARDWARE_ACK', payload);
    broadcastSSE({ type: 'HARDWARE_ACK', payload });
  } else {
    broadcast('HARDWARE_MANAGER_UPDATE', payload);
    broadcastSSE({ type: 'HARDWARE_MANAGER_UPDATE', state: payload });
  }
});

// ----------------------------------------------------------------------------
// WebSocket Real-time Broadcast
// ----------------------------------------------------------------------------
function broadcast(type, payload) {
  const message = JSON.stringify({ type, data: payload, timestamp: Date.now() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Server-Sent Events (SSE) Broadcast for lightweight HTTP consumers
const sseClients = new Set();
function broadcastSSE(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(message);
  }
}

simulator.setBroadcastCallback(record => {
  broadcast('TELEMETRY_UPDATE', record);
  broadcastSSE({ type: 'TELEMETRY_UPDATE', point: record, hardware: hardwareState });
});

wss.on('connection', (ws, req) => {
  const devKey = req?.headers?.['x-device-key'];
  const devIdHeader = req?.headers?.['x-device-id'];
  if (config.deviceKey && devKey && devKey === config.deviceKey && typeof devIdHeader === 'string' && devIdHeader.trim()) {
    const devId = devIdHeader.trim();
    hardwareManager.registerDevice({ deviceId: devId, ip: req.socket?.remoteAddress || '' });
    hardwareManager.attachDeviceSocket(devId, ws);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'HEARTBEAT') {
          const parsed = HardwareHeartbeatSchema.safeParse({ ...msg.data, deviceId: devId });
          if (parsed.success) hardwareManager.recordHeartbeat(parsed.data, req.socket?.remoteAddress || '');
        } else if (msg.type === 'ACK') {
          const parsed = HardwareAckSchema.safeParse({ ...msg.data, deviceId: devId });
          if (parsed.success) hardwareManager.recordAck(parsed.data);
        }
      } catch {
        // Ignore malformed WS frame
      }
    });

    ws.on('close', () => {
      hardwareManager.detachDeviceSocket(devId);
    });
    return;
  }

  // Cross-Site WebSocket Hijacking protection in production
  const wsOrigin = req?.headers?.origin;
  if (process.env.NODE_ENV === 'production' && (!wsOrigin || !allowedOrigins.has(wsOrigin))) {
    ws.close(1008, 'Forbidden origin');
    return;
  }

  console.log('[WS] Dashboard client connected. Total clients:', wss.clients.size);

  // Send initial snapshot on connect (including hardware state, gates, and config)
  ws.send(JSON.stringify({
    type: 'INITIAL_STATE',
    data: {
      zones: storage.getZones(),
      gates: storage.getGates(),
      config: storage.getConfig(),
      alerts: storage.getAlerts(20),
      simulatorRunning: simulator.isRunning,
      hardware: hardwareState,
      hardwareManager: hardwareManager.getSnapshot()
    },
    timestamp: Date.now()
  }));

  ws.on('close', () => {
    console.log('[WS] Dashboard client disconnected. Total clients:', wss.clients.size);
  });
});

// ----------------------------------------------------------------------------
// Device Authentication Middleware (Supports Header, Bearer, and Localhost Dev)
// ----------------------------------------------------------------------------
function requireDeviceAuth(req, res, next) {
  const deviceKey = req.headers['x-device-key'];
  const authHeader = req.headers['authorization'];
  const bearerKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const provided = deviceKey || bearerKey;

  const validKeys = config.deviceKey ? [config.deviceKey] : [];
  if (process.env.NODE_ENV !== 'production') {
    validKeys.push('cpr-secret-key-2026');
  }
  if (provided && validKeys.includes(provided)) {
    return next();
  }

  // Allow loopback socket only in non-production development (never trust spoofable Host header)
  const remoteAddr = req.socket?.remoteAddress || '';
  const isLoopback = remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';
  if (process.env.NODE_ENV !== 'production' && !provided && isLoopback) {
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Missing or invalid X-Device-Key or Authorization header'
  });
}

// ----------------------------------------------------------------------------
// API Routes
// ----------------------------------------------------------------------------

// POST /api/telemetry (from YOLO AI Vision, ESP32, or simulation)
app.post('/api/telemetry', requireDeviceAuth, (req, res) => {
  let body = { ...req.body };

  // Forgiving defaults for targetCount / count from YOLO vision or ESP32
  const countVal = Number(body.targetCount ?? body.count ?? body.visiblePersons ?? 0);
  if (body.targetCount === undefined) body.targetCount = countVal;
  if (body.entryCount === undefined) body.entryCount = 0;
  if (body.exitCount === undefined) body.exitCount = 0;
  if (body.density === undefined) body.density = countVal;
  if (body.avgSpeed === undefined) body.avgSpeed = 1.2;
  if (body.stopGoIndex === undefined) body.stopGoIndex = 0.0;
  if (!body.state) {
    body.state = countVal >= 10 ? 'RED' : (countVal >= 5 ? 'AMBER' : 'GREEN');
  }

  // Normalize score: if score is 0.0 - 1.0, scale to 0 - 100 for charts
  if (typeof body.score === 'number' && body.score <= 1.0 && body.score > 0) {
    body.score = Math.round(body.score * 100);
  } else if (body.score === undefined) {
    body.score = countVal >= 10 ? 85.0 : (countVal >= 5 ? 55.0 : Math.min(40.0, countVal * 10.0));
  }
  
  if (!body.zoneId) body.zoneId = 'zone-entry-a';
  if (!body.deviceId) body.deviceId = 'cpr-vision-gate-01';
  if (!body.timestamp) body.timestamp = Date.now();
  if (!body.activeAlerts) body.activeAlerts = [];
  if (!body.firmwareVersion) body.firmwareVersion = '1.0.0';

  const parsed = TelemetrySchema.safeParse(body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid Telemetry Payload',
      details: parsed.error.format()
    });
  }

  const { deviceId, targetCount } = parsed.data;

  // Rate Limiting
  if (!storage.checkRateLimit(deviceId)) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit of ${config.rateLimitReqPerSec} requests/second exceeded for device ${deviceId}`
    });
  }

  // Update camera online status & hardware control logic
  const opticalHealth = parsed.data.opticalHealth || 'HEALTHY';
  hardwareState.cameraOnline = opticalHealth === 'HEALTHY';
  hardwareState.lastCameraPing = Date.now();
  if (opticalHealth !== 'HEALTHY' && storage.getConfig().autoFailover) {
    hardwareState.systemMode = 'HARDWARE_FAILOVER';
    notifier.notifyEvent(
      `optical:${parsed.data.zoneId}`,
      '⚠️ CPR Optical Watchdog Triggered',
      [
        `Zone: <code>${parsed.data.zoneId}</code>`,
        `Issue: <b>${opticalHealth}</b>`,
        `Action: Switched to Hardware / Radar Assist mode.`
      ],
      parsed.data.ownerEmail || null,
      90
    );
  } else if (opticalHealth === 'HEALTHY' && hardwareState.systemMode === 'HARDWARE_FAILOVER') {
    hardwareState.systemMode = 'AI_VISION_PRIMARY';
    console.log('[CPR-Backend] Camera reconnected. Primary AI Vision mode restored.');
  }
  updateControlLogic(targetCount);
  hardwareManager.onYoloTelemetry({
    count: targetCount,
    density: parsed.data.density,
    score: parsed.data.score,
    state: parsed.data.state
  });

  const record = storage.addTelemetry(parsed.data);

  // Broadcast live telemetry to all connected dashboard websockets & SSE
  broadcast('TELEMETRY_UPDATE', record);
  broadcastSSE({ type: 'TELEMETRY_UPDATE', point: record, hardware: hardwareState });

  return res.status(201).json({ status: 'ok', receivedAt: record.serverTimestamp, hardware: hardwareState });
});

// GET /api/esp32/status (Direct polling endpoint for physical ESP32 Master node)
app.get('/api/esp32/status', (req, res) => {
  const cmd = hardwareManager.targetCommand;
  const isRed = cmd.alertLevel === 'RED';
  const isYellow = cmd.alertLevel === 'AMBER';
  const ledColor = isRed ? 'RED' : (isYellow ? 'YELLOW' : 'GREEN');

  res.json({
    operatingMode: hardwareManager.operatingMode,
    mode: hardwareState.systemMode,
    seq: cmd.seq,
    nonce: cmd.nonce,
    ts: cmd.ts,
    alertLevel: cmd.alertLevel,
    commandType: cmd.type,
    buzzerPattern: cmd.buzzer,
    count: hardwareState.currentCount,
    led: ledColor,
    rgb: hardwareState.rgb,
    ledPins: {
      red: isRed ? 1 : 0,
      yellow: isYellow ? 1 : 0,
      green: (!isRed && !isYellow) ? 1 : 0
    },
    servoAngle: cmd.servoAngle,
    servoStatus: hardwareState.servoStatus,
    buzzer: cmd.buzzer !== 'OFF',
    oled: hardwareState.oled
  });
});

// ============================================================================
// ESP32 DIRECT WI-FI INTEGRATION, MODE CONTROL & HARDWARE TELEMETRY
// ============================================================================
app.post('/api/hardware/register', requireDeviceAuth, (req, res) => {
  const parsed = HardwareRegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid registration payload', details: parsed.error.format() });
  }
  const device = hardwareManager.registerDevice({
    ...parsed.data,
    ip: parsed.data.ip || req.ip || ''
  });
  return res.status(201).json({ status: 'ok', device, targetCommand: hardwareManager.targetCommand });
});

app.post('/api/hardware/heartbeat', requireDeviceAuth, (req, res) => {
  const parsed = HardwareHeartbeatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid heartbeat payload', details: parsed.error.format() });
  }
  const device = hardwareManager.recordHeartbeat(parsed.data, req.ip || '');
  return res.json({ status: 'ok', device, targetCommand: hardwareManager.targetCommand });
});

app.post('/api/hardware/telemetry', requireDeviceAuth, (req, res) => {
  const parsed = HardwareHeartbeatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid hardware telemetry payload', details: parsed.error.format() });
  }
  const device = hardwareManager.recordHeartbeat(parsed.data, req.ip || '');
  return res.json({ status: 'ok', device, targetCommand: hardwareManager.targetCommand });
});

app.post('/api/hardware/ack', requireDeviceAuth, (req, res) => {
  const parsed = HardwareAckSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid ack payload', details: parsed.error.format() });
  }
  const result = hardwareManager.recordAck(parsed.data);
  if (result.duplicate) {
    return res.status(409).json({ status: 'duplicate_rejected', seq: result.seq });
  }
  return res.json({ status: 'ok', ...result });
});

app.get('/api/hardware/state', (req, res) => {
  return res.json({ status: 'ok', hardware: hardwareManager.getSnapshot() });
});

app.post('/api/hardware/mode', requireMasterAuth, async (req, res) => {
  const parsed = HardwareModeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid operating mode', details: parsed.error.format() });
  }
  const result = await hardwareManager.setOperatingMode(parsed.data.mode);
  if (!result.ok) {
    return res.status(504).json({ status: 'error', error: result.error, hardware: hardwareManager.getSnapshot() });
  }
  const auditEntry = storage.addAuditLog({
    actorEmail: req.masterUser?.email || 'operator',
    action: 'HARDWARE_MODE',
    target: 'system',
    detail: `Switched operating mode to ${result.mode}`
  });
  broadcast('AUDIT_UPDATED', auditEntry);
  return res.json({ status: 'ok', mode: result.mode, hardware: hardwareManager.getSnapshot() });
});

app.post('/api/hardware/command', requireMasterAuth, (req, res) => {
  const parsed = HardwareCommandSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid hardware command', details: parsed.error.format() });
  }
  const cmd = hardwareManager.issueCommand({
    ...parsed.data,
    source: 'OPERATOR_DASHBOARD'
  });
  return res.json({ status: 'ok', command: cmd, hardware: hardwareManager.getSnapshot() });
});

app.post('/api/hardware/demo', requireMasterAuth, (req, res) => {
  const parsed = HardwareDemoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid demo payload', details: parsed.error.format() });
  }
  const result = hardwareManager.setDemoSimulation(parsed.data);
  return res.json({ status: 'ok', ...result, hardware: hardwareManager.getSnapshot() });
});

// GET /api/stream - Server-Sent Events (SSE) stream for browsers
app.get('/api/stream', (req, res) => {
  const origin = req.headers.origin;
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  };
  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  res.writeHead(200, headers);
  res.write(`data: ${JSON.stringify({ type: 'INITIAL_STATE', hardware: hardwareState })}\n\n`);
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// POST /api/gates/reset-all & /api/master/reset - Reset all gates to AUTO live mode (protected)
function getOptionalEmail(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token || !config.jwtSecret) return null;
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    return decoded?.email || null;
  } catch {
    return null;
  }
}

function handleResetAll(req, res) {
  const userEmail = req.masterUser?.email || null;
  const updatedGates = storage.resetAllGates(userEmail);
  hardwareState.currentCount = 0;
  hardwareState.cameraOnline = true;
  hardwareState.lastCameraPing = Date.now();
  hardwareState.systemMode = 'AI_VISION_PRIMARY';
  updateControlLogic(0);
  updatedGates.forEach((g) => {
    if (g) {
      broadcast('GATE_UPDATED', g);
      const pt = storage.addTelemetry({
        deviceId: g.zoneId === 'zone-entry-a' ? 'esp32-radar-01' : 'esp32-radar-02',
        zoneId: g.zoneId,
        timestamp: Date.now(),
        state: 'GREEN',
        score: 0,
        density: 0,
        avgSpeed: 1.3,
        stopGoIndex: 0.05,
        targetCount: 0,
        entryCount: 0,
        exitCount: 0
      });
      broadcast('TELEMETRY_UPDATE', pt);
    }
  });
  broadcast('HARDWARE_UPDATE', hardwareState);
  const auditReset = storage.addAuditLog({
    actorEmail: userEmail || 'operator',
    action: 'GATE_RESET_ALL',
    target: 'all-gates',
    detail: 'Reset all gates to GREEN (90 deg OPEN)'
  });
  broadcast('AUDIT_UPDATED', auditReset);
  res.json({ status: 'ok', gates: updatedGates, hardware: hardwareState });
}
app.post('/api/gates/reset-all', requireMasterAuth, handleResetAll);
app.post('/api/master/reset', requireMasterAuth, handleResetAll);

// GET /api/zones - Zone list with latest status
app.get('/api/zones', (req, res) => {
  const email = getOptionalEmail(req);
  res.json({ zones: storage.getZones(), gates: storage.getGates(email), hardware: hardwareState });
});

// GET /api/gates - Multi-gate list (scoped to logged-in user's inputted gates when authenticated)
app.get('/api/gates', (req, res) => {
  const email = getOptionalEmail(req);
  res.json({ gates: storage.getGates(email), hardware: hardwareState });
});

// POST /api/gates/:id/override - Manual override for specific gate (protected)
app.post('/api/gates/:id/override', requireMasterAuth, (req, res) => {
  const { id } = req.params;
  const { manualState } = req.body || {};
  const allowedStates = ['AUTO', 'RESUME_AUTO', 'FORCE_OPEN', 'FORCE_METER', 'FORCE_LOCK', 'EMERGENCY_LOCK'];
  if (!manualState || !allowedStates.includes(manualState)) {
    return res.status(400).json({ error: 'Invalid manualState' });
  }
  const email = req.masterUser?.email || null;
  const updated = storage.updateGateOverride(id, manualState, email);
  if (!updated) {
    return res.status(404).json({ error: 'Gate not found' });
  }

  // If Gate A is controlled, keep physical ESP32 in sync
  if (id === 'gate-a') {
    hardwareState.servoAngle = updated.servoAngle;
    hardwareState.servoStatus = updated.servoStatus;
    updateControlLogic();
  }

  broadcast('GATE_UPDATED', updated);
  broadcastSSE({ type: 'GATE_UPDATED', gate: updated, gates: storage.getGates(email) });
  const auditOverride = storage.addAuditLog({
    actorEmail: email || 'operator',
    action: 'GATE_OVERRIDE',
    target: updated.id,
    detail: `${updated.name} -> ${manualState}`
  });
  if (manualState === 'FORCE_LOCK' || manualState === 'EMERGENCY_LOCK') {
    notifier.notifyEvent(
      `lock:${updated.id}`,
      '🔒 CPR Manual Emergency Lock',
      [
        `Gate: <b>${updated.name}</b>`,
        `Operator: ${email || 'operator'}`,
        `Barrier: 0° (LOCKED)`
      ],
      email,
      10
    );
  }
  broadcast('AUDIT_UPDATED', auditOverride);
  res.json({ status: 'ok', gate: updated });
});

// PUT /api/gates/:id/settings - Post-setup gate thresholds, name & per-gate camera URL
app.put('/api/gates/:id/settings', requireMasterAuth, (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const email = req.masterUser?.email || null;
  const existing = storage.getGate(id, email);
  if (!existing) {
    return res.status(404).json({ error: 'Gate not found' });
  }

  const amber = body.amberThreshold !== undefined ? Number(body.amberThreshold) : existing.amberThreshold;
  const red = body.redThreshold !== undefined ? Number(body.redThreshold) : existing.redThreshold;
  if (!Number.isInteger(amber) || amber < 1 || amber > 150) {
    return res.status(400).json({ error: 'amberThreshold must be an integer between 1 and 150' });
  }
  if (!Number.isInteger(red) || red <= amber || red > 200) {
    return res.status(400).json({ error: 'redThreshold must be an integer greater than amberThreshold (max 200)' });
  }
  if (body.cameraStreamUrl !== undefined && typeof body.cameraStreamUrl === 'string' && body.cameraStreamUrl.trim() !== '') {
    if (!/^https?:\/\/.+/.test(body.cameraStreamUrl.trim())) {
      return res.status(400).json({ error: 'cameraStreamUrl must start with http:// or https://' });
    }
  }

  const updated = storage.updateGateSettings(id, {
    name: body.name,
    amberThreshold: amber,
    redThreshold: red,
    cameraStreamUrl: body.cameraStreamUrl
  }, email);

  broadcast('GATE_UPDATED', updated);
  const zone = storage.zones.get(updated.zoneId);
  if (zone) broadcast('ZONE_CONFIG_UPDATED', zone);
  const auditEntry = storage.addAuditLog({
    actorEmail: email || 'operator',
    action: 'GATE_SETTINGS_UPDATED',
    target: updated.id,
    detail: `${updated.name} (Amber ${updated.amberThreshold}, Red ${updated.redThreshold})`
  });
  broadcast('AUDIT_UPDATED', auditEntry);
  res.json({ status: 'ok', gate: updated });
});

// POST /api/gates - Add a gate post-setup (max 4 per operator)
app.post('/api/gates', requireMasterAuth, (req, res) => {
  const email = req.masterUser?.email || null;
  const body = req.body || {};
  const amber = body.amberThreshold !== undefined ? Number(body.amberThreshold) : 5;
  const red = body.redThreshold !== undefined ? Number(body.redThreshold) : 10;
  if (!Number.isInteger(amber) || amber < 1 || !Number.isInteger(red) || red <= amber || red > 200) {
    return res.status(400).json({ error: 'Invalid gate thresholds' });
  }
  if (body.cameraStreamUrl && typeof body.cameraStreamUrl === 'string' && body.cameraStreamUrl.trim() !== '' && !/^https?:\/\/.+/.test(body.cameraStreamUrl.trim())) {
    return res.status(400).json({ error: 'cameraStreamUrl must start with http:// or https://' });
  }

  const result = storage.addGateForUser(email, {
    name: body.name,
    amberThreshold: amber,
    redThreshold: red,
    cameraStreamUrl: body.cameraStreamUrl
  });
  if (result.limitReached) {
    return res.status(400).json({ error: 'Maximum of 4 gates allowed per operator' });
  }
  const allGates = storage.getGates(email);
  broadcast('GATES_SYNCED', allGates);
  const auditEntry = storage.addAuditLog({
    actorEmail: email || 'operator',
    action: 'GATE_ADDED',
    target: result.gate.id,
    detail: `Added gate ${result.gate.name}`
  });
  broadcast('AUDIT_UPDATED', auditEntry);
  res.status(201).json({ status: 'ok', gate: result.gate, gates: allGates });
});

// DELETE /api/gates/:id - Remove a gate post-setup (minimum 1 gate kept)
app.delete('/api/gates/:id', requireMasterAuth, (req, res) => {
  const { id } = req.params;
  const email = req.masterUser?.email || null;
  const result = storage.removeGateForUser(email, id);
  if (result.notFound) return res.status(404).json({ error: 'Gate not found' });
  if (result.minReached) return res.status(400).json({ error: 'At least one gate must remain active' });

  const allGates = storage.getGates(email);
  broadcast('GATES_SYNCED', allGates);
  const auditEntry = storage.addAuditLog({
    actorEmail: email || 'operator',
    action: 'GATE_REMOVED',
    target: id,
    detail: `Removed gate ${id}`
  });
  broadcast('AUDIT_UPDATED', auditEntry);
  res.json({ status: 'ok', gates: allGates });
});

// POST /api/gates/:id/power - Toggle gate power (protected)
app.post('/api/gates/:id/power', requireMasterAuth, (req, res) => {
  const { id } = req.params;
  const { power } = req.body || {};
  if (typeof power !== 'boolean') {
    return res.status(400).json({ error: 'power must be a boolean' });
  }
  const email = req.masterUser?.email || null;
  const updated = storage.updateGatePower(id, power, email);
  if (!updated) return res.status(404).json({ error: 'Gate not found' });

  broadcast('GATE_UPDATED', updated);
  broadcastSSE({ type: 'GATE_UPDATED', gate: updated, gates: storage.getGates(email) });
  const auditPower = storage.addAuditLog({
    actorEmail: email || 'operator',
    action: 'GATE_POWER',
    target: updated.id,
    detail: `${updated.name} -> ${power ? 'ON' : 'OFF'}`
  });
  broadcast('AUDIT_UPDATED', auditPower);
  res.json({ status: 'ok', gate: updated });
});

// POST /api/gates/:id/density - Increase or decrease gate crowd count (protected)
app.post('/api/gates/:id/density', requireMasterAuth, (req, res) => {
  const { id } = req.params;
  const { delta } = req.body || {};
  if (typeof delta !== 'number' || !Number.isInteger(delta) || delta < -100 || delta > 100) {
    return res.status(400).json({ error: 'delta must be an integer between -100 and 100' });
  }
  const email = req.masterUser?.email || null;
  const updated = storage.updateGateDensity(id, delta, email);
  if (!updated) return res.status(404).json({ error: 'Gate not found' });

  if (id === 'gate-a') {
    updateControlLogic(updated.count);
  }

  // Inject point into storage so charts update
  const point = storage.addTelemetry({
    deviceId: updated.zoneId === 'zone-entry-a' ? 'cpr-vision-gate-01' : 'esp32-radar-02',
    zoneId: updated.zoneId,
    timestamp: Date.now(),
    state: updated.status,
    score: updated.riskScore,
    density: updated.density,
    avgSpeed: updated.status === 'RED' ? 0.08 : (updated.status === 'AMBER' ? 0.65 : 1.3),
    stopGoIndex: updated.status === 'RED' ? 0.75 : (updated.status === 'AMBER' ? 0.35 : 0.08),
    targetCount: updated.count,
    entryCount: 200 + updated.count,
    exitCount: 180,
    activeAlerts: updated.status === 'RED' ? ['CRITICAL_STALL_DETECTED'] : [],
    firmwareVersion: '3.2.0'
  });

  broadcast('TELEMETRY_UPDATE', point);
  broadcast('GATE_UPDATED', updated);
  broadcastSSE({ type: 'TELEMETRY_UPDATE', point, gate: updated, gates: storage.getGates() });
  res.json({ status: 'ok', gate: updated });
});

// ============================================================================
// PRIVATE MASTER REMOTE ENDPOINTS (Protected with bcrypt + JWT + Rate Limit)
// Completely silent background operation for authorized operators
// ============================================================================
const masterAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' }
});

const accountUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Authenticated profile/password update limit per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many account update attempts. Please try again later.' }
});

function requireMasterAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token || !config.jwtSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (!decoded || (decoded.role !== 'master' && decoded.role !== 'operator')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.masterUser = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function getOptionalMasterEmail(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token || !config.jwtSecret) return null;
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (!decoded || (decoded.role !== 'master' && decoded.role !== 'operator')) return null;
    return decoded.email || null;
  } catch {
    return null;
  }
}

// POST /api/master/auth - Authenticate operator PIN or access key via bcrypt + JWT
app.post('/api/master/auth', masterAuthLimiter, async (req, res) => {
  const rawCredential = req.body?.credential ?? req.body?.key ?? '';
  const credential = typeof rawCredential === 'string' ? rawCredential.trim() : '';

  if (!credential || !config.jwtSecret || (!config.masterPinHash && !config.masterKeyHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  try {
    let valid = false;
    if (config.masterPinHash) {
      valid = await bcrypt.compare(credential, config.masterPinHash);
    }
    if (!valid && config.masterKeyHash) {
      valid = await bcrypt.compare(credential, config.masterKeyHash);
    }

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ role: 'master' }, config.jwtSecret, { expiresIn: '2h' });
    const cfg = storage.getConfig();
    return res.json({
      success: true,
      token,
      setupComplete: Boolean(cfg?.isConfigured)
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
});

// GET /api/master/verify - Verify active JWT session
app.get('/api/master/verify', requireMasterAuth, (req, res) => {
  res.json({ valid: true, expiresAt: req.masterUser?.exp || null });
});

// POST /api/auth/signup - Register operator with email, phone number, and password
app.post('/api/auth/signup', masterAuthLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }
  if (!phone || phone.replace(/[^0-9]/g, '').length < 7) {
    return res.status(400).json({ error: 'Valid phone number is required' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!config.jwtSecret) {
    return res.status(500).json({ error: 'Authentication service not configured' });
  }
  if (storage.getUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const user = storage.createUser({ email, phone, passwordHash });
    const token = jwt.sign({ role: 'operator', email: user.email }, config.jwtSecret, { expiresIn: '2h' });
    return res.status(201).json({
      success: true,
      token,
      setupComplete: false,
      user: { email: user.email, phone: user.phone }
    });
  } catch {
    return res.status(500).json({ error: 'Failed to create account' });
  }
});

// POST /api/auth/login - Sign in with email and password
app.post('/api/auth/login', masterAuthLimiter, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password || !config.jwtSecret) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  try {
    const user = storage.getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ role: 'operator', email: user.email }, config.jwtSecret, { expiresIn: '2h' });
    return res.json({
      success: true,
      token,
      setupComplete: Boolean(user.setupComplete),
      user: { email: user.email, phone: user.phone }
    });
  } catch {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
});

// POST /api/auth/verify-password - Verify logged-in operator's password for /master access
app.post('/api/auth/verify-password', requireMasterAuth, masterAuthLimiter, async (req, res) => {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const email = req.masterUser?.email;
  if (!email || !password) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  try {
    const user = storage.getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid password' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid password' });
    return res.json({ success: true, email: user.email });
  } catch {
    return res.status(401).json({ error: 'Invalid password' });
  }
});

// GET /api/auth/me - Fetch current signed-in operator profile
app.get('/api/auth/me', requireMasterAuth, (req, res) => {
  const email = req.masterUser?.email;
  const user = email ? storage.getUserByEmail(email) : null;
  res.json({
    user: user
      ? {
          email: user.email,
          phone: user.phone || '',
          displayName: user.displayName || '',
          setupComplete: Boolean(user.setupComplete),
          createdAt: user.createdAt || null
        }
      : {
          email: email || 'master-operator',
          phone: '',
          displayName: 'Master Operator',
          setupComplete: true,
          createdAt: null
        },
    sessionExpiresAt: req.masterUser?.exp ? req.masterUser.exp * 1000 : null
  });
});

// PUT /api/auth/profile - Update operator email, phone, and displayName
app.put('/api/auth/profile', requireMasterAuth, accountUpdateLimiter, async (req, res) => {
  const currentEmail = req.masterUser?.email;
  if (!currentEmail) {
    return res.status(400).json({ error: 'Account profile editing requires an operator email login' });
  }
  const user = storage.getUserByEmail(currentEmail);
  if (!user) {
    return res.status(404).json({ error: 'Operator account not found' });
  }

  const nextEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : user.email;
  const nextPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : (user.phone || '');
  const nextDisplayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : (user.displayName || '');
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';

  if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }
  if (nextPhone && nextPhone.replace(/[^0-9]/g, '').length < 7) {
    return res.status(400).json({ error: 'Valid phone number is required (at least 7 digits)' });
  }

  const emailChanged = nextEmail !== user.email;
  if (emailChanged) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to change your email address' });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
  }

  const result = storage.updateUserProfile(user.email, {
    newEmail: nextEmail,
    phone: nextPhone,
    displayName: nextDisplayName
  });

  if (result.conflict) {
    return res.status(409).json({ error: 'Another account already uses this email address' });
  }
  if (!result.user) {
    return res.status(404).json({ error: 'Operator account not found' });
  }

  const updatedToken = emailChanged && config.jwtSecret
    ? jwt.sign({ role: 'operator', email: result.user.email }, config.jwtSecret, { expiresIn: '2h' })
    : null;

  const auditEntry = storage.addAuditLog({
    actorEmail: result.user.email,
    action: 'PROFILE_UPDATED',
    target: result.user.email,
    detail: emailChanged ? `Updated email (${user.email} -> ${result.user.email})` : 'Updated profile contact details'
  });
  broadcast('AUDIT_UPDATED', auditEntry);

  return res.json({
    success: true,
    token: updatedToken,
    user: {
      email: result.user.email,
      phone: result.user.phone || '',
      displayName: result.user.displayName || '',
      setupComplete: Boolean(result.user.setupComplete),
      createdAt: result.user.createdAt || null
    }
  });
});

// PUT /api/auth/password - Update operator password
app.put('/api/auth/password', requireMasterAuth, accountUpdateLimiter, async (req, res) => {
  const email = req.masterUser?.email;
  if (!email) {
    return res.status(400).json({ error: 'Password change requires an operator email login' });
  }
  const user = storage.getUserByEmail(email);
  if (!user) {
    return res.status(404).json({ error: 'Operator account not found' });
  }

  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (!currentPassword) {
    return res.status(400).json({ error: 'Current password is required' });
  }
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  try {
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const newHash = await bcrypt.hash(newPassword, 12);
    storage.updateUserPassword(user.email, newHash);
    const auditEntry = storage.addAuditLog({
      actorEmail: user.email,
      action: 'PASSWORD_CHANGED',
      target: user.email,
      detail: 'Operator password updated'
    });
    broadcast('AUDIT_UPDATED', auditEntry);
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

// POST /api/master/command - Silent remote command execution (JWT protected)
app.post('/api/master/command', requireMasterAuth, (req, res) => {
  const { action, gateId = 'gate-a', manualState, delta, count, state, cameraOnline, power } = req.body || {};
  const email = req.masterUser?.email || null;
  const userGates = storage.getGates(email);
  let targetGate = storage.getGate(gateId, email) || userGates[0];
  if (!targetGate) {
    return res.status(404).json({ error: 'Gate not found' });
  }

  // 1. Gate Override (0°, 45°, 90°, AUTO)
  if (action === 'OVERRIDE' && manualState) {
    targetGate = storage.updateGateOverride(targetGate.id, manualState, email);
    if (targetGate.id === 'gate-a') {
      hardwareState.servoAngle = targetGate.servoAngle;
      hardwareState.servoStatus = targetGate.servoStatus;
    }
  }

  // 2. Relative Population/Density Adjustment (+1, -1, +5, -5)
  else if (action === 'DENSITY' && typeof delta === 'number') {
    targetGate = storage.updateGateDensity(targetGate.id, delta, email);
    if (targetGate.id === 'gate-a') {
      updateControlLogic(targetGate.count);
    }
  }

  // 3. Absolute Population Count Setting
  else if (action === 'SET_POPULATION' && typeof count === 'number') {
    const safeCount = Math.max(0, Math.min(50, count));
    const deltaCount = safeCount - targetGate.count;
    targetGate = storage.updateGateDensity(targetGate.id, deltaCount, email);
    if (targetGate.id === 'gate-a') {
      updateControlLogic(safeCount);
    }
  }

  // 4. Direct Gate State Setting (GREEN / AMBER / RED)
  else if (action === 'SET_STATE' && state) {
    targetGate.status = state;
    if (state === 'RED') {
      targetGate.count = Math.max(targetGate.count, targetGate.redThreshold || 10);
      targetGate.density = 4.2;
      targetGate.riskScore = 88;
      targetGate.servoAngle = 0;
      targetGate.servoStatus = 'LOCKED (0°)';
    } else if (state === 'AMBER') {
      targetGate.count = Math.max(targetGate.count, targetGate.amberThreshold || 5);
      targetGate.density = 2.1;
      targetGate.riskScore = 55;
      targetGate.servoAngle = 45;
      targetGate.servoStatus = 'METERED (45°)';
    } else {
      targetGate.count = Math.min(targetGate.count, 3);
      targetGate.density = 0.8;
      targetGate.riskScore = 18;
      targetGate.servoAngle = 90;
      targetGate.servoStatus = 'OPEN (90°)';
    }
    targetGate.lastUpdated = Date.now();
    storage.gates.set(gateId, targetGate);

    if (gateId === 'gate-a') {
      updateControlLogic(targetGate.count);
    }
  }

  // 5. Simulate Camera Disconnect / Radar Failover Takeover
  else if (action === 'SIMULATE_FAILOVER' && typeof cameraOnline === 'boolean') {
    hardwareState.cameraOnline = cameraOnline;
    hardwareState.lastCameraPing = cameraOnline ? Date.now() : 0;
    hardwareState.systemMode = cameraOnline ? 'AI_VISION_PRIMARY' : 'HARDWARE_FAILOVER';
    if (!cameraOnline) {
      hardwareState.oled.line1 = 'FAILOVER: RADAR';
    } else {
      hardwareState.oled.line1 = 'AI VISION: LIVE';
    }
  }

  // 6. Gate Power Toggle
  else if (action === 'POWER' && typeof power === 'boolean') {
    targetGate = storage.updateGatePower(targetGate.id, power, email);
  }

  // 7. Reset everything back to live data
  else if (action === 'RESET_ALL') {
    const resetGates = storage.resetAllGates(email);
    hardwareState.currentCount = 0;
    hardwareState.cameraOnline = true;
    hardwareState.lastCameraPing = Date.now();
    hardwareState.systemMode = 'AI_VISION_PRIMARY';
    updateControlLogic(0);
    targetGate = storage.getGate(targetGate.id, email) || resetGates[0];
    resetGates.forEach((fresh) => {
      if (fresh) broadcast('GATE_UPDATED', { ...fresh, silent: true });
    });
  }

  // Inject telemetry point so dashboard charts reflect count without interruption
  const point = storage.addTelemetry({
    deviceId: targetGate.zoneId === 'zone-entry-a' ? 'cpr-vision-gate-01' : 'esp32-radar-02',
    zoneId: targetGate.zoneId,
    timestamp: Date.now(),
    state: targetGate.status,
    score: targetGate.riskScore,
    density: targetGate.density,
    avgSpeed: targetGate.status === 'RED' ? 0.08 : (targetGate.status === 'AMBER' ? 0.65 : 1.3),
    stopGoIndex: targetGate.status === 'RED' ? 0.75 : (targetGate.status === 'AMBER' ? 0.35 : 0.08),
    targetCount: targetGate.count,
    entryCount: 200 + targetGate.count,
    exitCount: 180,
    activeAlerts: [],
    firmwareVersion: '3.2.0'
  });

  // SILENT BROADCAST: updates UI state smoothly in place with silent flag
  broadcast('TELEMETRY_UPDATE', { ...point, silent: true });
  broadcast('GATE_UPDATED', { ...targetGate, silent: true });
  broadcast('HARDWARE_UPDATE', hardwareState);
  broadcastSSE({ type: 'GATE_UPDATED', gate: targetGate, gates: storage.getGates(), silent: true });

  res.json({
    status: 'ok',
    silent: true,
    gate: targetGate,
    hardware: hardwareState
  });
});

// Protect any additional /api/master/* routes
app.use('/api/master', requireMasterAuth);

// GET /api/config & POST /api/config - System configuration persistence
app.get('/api/config', (req, res) => {
  res.json({ config: storage.getConfig() });
});

app.post('/api/config', requireMasterAuth, (req, res) => {
  const body = req.body || {};
  if (body.servoOpenAngle !== undefined && (!Number.isFinite(Number(body.servoOpenAngle)) || Number(body.servoOpenAngle) < 0 || Number(body.servoOpenAngle) > 180)) {
    return res.status(400).json({ error: 'servoOpenAngle must be between 0 and 180' });
  }
  if (body.servoLockedAngle !== undefined && (!Number.isFinite(Number(body.servoLockedAngle)) || Number(body.servoLockedAngle) < 0 || Number(body.servoLockedAngle) > 180)) {
    return res.status(400).json({ error: 'servoLockedAngle must be between 0 and 180' });
  }
  if (body.gateCount !== undefined && (!Number.isInteger(Number(body.gateCount)) || Number(body.gateCount) < 1 || Number(body.gateCount) > 4)) {
    return res.status(400).json({ error: 'gateCount must be an integer between 1 and 4' });
  }
  if (body.cameraStreamUrl !== undefined && typeof body.cameraStreamUrl === 'string' && body.cameraStreamUrl.trim() !== '') {
    if (!/^https?:\/\/.+/.test(body.cameraStreamUrl.trim())) {
      return res.status(400).json({ error: 'cameraStreamUrl must start with http:// or https://' });
    }
    body.cameraStreamUrl = body.cameraStreamUrl.trim();
  }
  const updated = storage.updateConfig(body);
  if (req.masterUser?.email) {
    if (Array.isArray(body.gateNames) && body.gateNames.length > 0) {
      storage.setGatesForUser(req.masterUser.email, body.gateNames, {
        amberThreshold: body.amberThreshold,
        redThreshold: body.redThreshold
      });
    }
    if (body.setupComplete) {
      storage.markUserSetupComplete(req.masterUser.email);
    }
  }
  broadcast('CONFIG_UPDATED', updated);
  res.json({ status: 'ok', config: updated });
});

// GET /api/analytics - Comprehensive crowd traffic & safety analytics
app.get('/api/analytics', (req, res) => {
  res.json({ analytics: storage.getAnalyticsSummary(), gates: storage.getGates() });
});

// GET /api/zones/:id/history - Recent time-series telemetry (default 10 minutes)
app.get('/api/zones/:id/history', (req, res) => {
  const zoneId = req.params.id;
  const minutes = parseInt(req.query.minutes || '10', 10);
  const email = getOptionalMasterEmail(req);
  const history = storage.getZoneHistory(zoneId, minutes, email);
  res.json({ zoneId, minutes, count: history.length, history });
});

// PUT /api/zones/:id - Update zone area, width, or name (protected)
app.put('/api/zones/:id', requireMasterAuth, (req, res) => {
  const zoneId = req.params.id;
  const parsed = ZoneConfigSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid config', details: parsed.error.format() });
  }

  const email = req.masterUser?.email || null;
  const updated = storage.updateZoneConfig(zoneId, parsed.data, email);
  if (!updated) {
    return res.status(404).json({ error: 'Zone not found' });
  }

  broadcast('ZONE_CONFIG_UPDATED', updated);
  storage.getGates(email).forEach((g) => {
    if (g.zoneId === zoneId) broadcast('GATE_UPDATED', g);
  });
  res.json({ status: 'ok', zone: updated });
});

// GET /api/alerts - Historical alert log (user-scoped when authenticated)
app.get('/api/alerts', (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  const email = getOptionalMasterEmail(req);
  res.json({ alerts: storage.getAlerts(limit, email) });
});

// POST /api/alerts/:id/ack - Acknowledge an alert (protected)
app.post('/api/alerts/:id/ack', requireMasterAuth, (req, res) => {
  const { id } = req.params;
  const note = typeof req.body?.note === 'string' ? req.body.note : '';
  const actorEmail = req.masterUser?.email || 'operator';
  const updated = storage.acknowledgeAlert(id, actorEmail, note);
  if (!updated) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  const auditEntry = storage.addAuditLog({
    actorEmail,
    action: 'ALERT_ACKNOWLEDGED',
    target: updated.zoneId,
    detail: `Acknowledged ${updated.toState} alert in ${updated.zoneName}`
  });
  broadcast('ALERT_UPDATED', updated);
  broadcast('AUDIT_UPDATED', auditEntry);
  res.json({ status: 'ok', alert: updated });
});

// GET /api/audit - Operator audit trail (protected, user-scoped)
app.get('/api/audit', requireMasterAuth, (req, res) => {
  const limit = parseInt(req.query.limit || '100', 10);
  res.json({ auditLogs: storage.getAuditLogs(limit, req.masterUser?.email || null) });
});

// Notification Channels (Telegram Bot & Meta WhatsApp Cloud API)
app.get('/api/notifications/config', requireMasterAuth, (req, res) => {
  const email = req.masterUser?.email || null;
  res.json({ config: notifier.getConfig(email) });
});

app.post('/api/notifications/config', requireMasterAuth, (req, res) => {
  const email = req.masterUser?.email || null;
  const saved = notifier.updateConfig(email, req.body || {});
  storage.addAuditLog({
    actorEmail: email || 'operator',
    action: 'NOTIFICATIONS_UPDATED',
    target: 'alerts',
    detail: `Telegram: ${saved.telegramEnabled ? 'ON' : 'OFF'}, WhatsApp: ${saved.whatsappEnabled ? 'ON' : 'OFF'}`
  });
  res.json({ status: 'ok', config: saved });
});

app.post('/api/notifications/telegram-detect', requireMasterAuth, async (req, res) => {
  try {
    const email = req.masterUser?.email || null;
    const token = req.body?.telegramBotToken || notifier.getConfig(email).telegramBotToken;
    const detected = await notifier.detectTelegramChatId(token);
    res.json({ status: 'ok', ...detected });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/notifications/test', requireMasterAuth, async (req, res) => {
  try {
    const email = req.masterUser?.email || null;
    if (req.body && Object.keys(req.body).length > 0) {
      notifier.updateConfig(email, req.body);
    }
    const results = await notifier.sendTest(email);
    res.json({ status: 'ok', results });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/notifications/send-report', requireMasterAuth, async (req, res) => {
  try {
    const email = req.masterUser?.email || null;
    if (req.body && Object.keys(req.body).length > 0) {
      notifier.updateConfig(email, req.body);
    }
    const gates = storage.getGates(email);
    const results = await notifier.sendLiveGateReport(gates, email);
    res.json({ status: 'ok', results });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/commands - Operator commands from dashboard (protected)
app.post('/api/commands', requireMasterAuth, (req, res) => {
  const parsed = CommandSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid command payload', details: parsed.error.format() });
  }

  const { deviceId, command, reason } = parsed.data;
  const queued = storage.queueCommand(deviceId, command, reason);

  console.log(`[API COMMAND] Queued '${command}' for ${deviceId}. Reason: ${reason || 'Operator manual'}`);
  broadcast('COMMAND_DISPATCHED', queued);

  // Apply to physical actuators immediately
  if (command === 'MANUAL_GATE_CLOSE') {
    hardwareState.servoAngle = 0;
    hardwareState.servoStatus = 'CLOSED (LOCKED)';
    updateControlLogic();
  } else if (command === 'MANUAL_GATE_OPEN') {
    hardwareState.servoAngle = 90;
    hardwareState.servoStatus = 'OPEN';
    updateControlLogic();
  }

  res.status(202).json({ status: 'queued', command: queued, hardware: hardwareState });
});

// GET /api/commands/:deviceId - ESP32 long/short polling endpoint
app.get('/api/commands/:deviceId', requireDeviceAuth, (req, res) => {
  const { deviceId } = req.params;
  const pendingCmd = storage.getPendingCommand(deviceId);

  if (pendingCmd) {
    res.json({ command: pendingCmd.command, id: pendingCmd.id, reason: pendingCmd.reason });
  } else {
    res.json({ command: null });
  }
});

// POST /api/simulate - Toggle generator OR drive Interactive Demo Sandbox (protected)
app.post('/api/simulate', requireMasterAuth, (req, res) => {
  const { action, count, cameraOnline } = req.body || {};

  // Interactive Demo Sandbox Slider support
  if (typeof count === 'number') {
    const targetGateId = (req.body && (req.body.gateId || req.body.zoneId === 'zone-corridor-b' ? 'gate-b' : 'gate-a')) || 'gate-a';
    const targetZoneId = targetGateId === 'gate-b' ? 'zone-corridor-b' : 'zone-entry-a';
    const c = Math.max(0, count);
    const state = c >= 10 ? 'RED' : (c >= 5 ? 'AMBER' : 'GREEN');
    const score = Math.min(100, Math.round(c * 6.6));
    const density = Math.min(6.0, Number((c / 4.0).toFixed(2)));
    const avgSpeed = Math.max(0.1, Number((1.4 - c * 0.08).toFixed(2)));
    const stopGoIndex = c >= 10 ? 0.78 : (c >= 5 ? 0.35 : 0.05);

    if (typeof cameraOnline === 'boolean') {
      hardwareState.cameraOnline = cameraOnline;
      hardwareState.systemMode = cameraOnline ? 'AI_VISION_PRIMARY' : 'HARDWARE_FAILOVER';
    }

    if (targetGateId === 'gate-a') {
      updateControlLogic(c);
    }

    const gate = storage.getGate(targetGateId);
    if (gate) {
      gate.count = c;
      gate.density = density;
      gate.riskScore = score;
      gate.status = state;
      gate.servoAngle = state === 'RED' ? 0 : (state === 'AMBER' ? 45 : 90);
      gate.servoStatus = state === 'RED' ? 'CLOSED (LOCKED)' : (state === 'AMBER' ? 'METERED (PARTIAL)' : 'OPEN');
      gate.lastUpdated = Date.now();
    }

    // Inject into storage for zone so all charts, gauges, and badges update
    const point = storage.addTelemetry({
      deviceId: targetGateId === 'gate-b' ? 'esp32-radar-02' : 'simulated-master-01',
      zoneId: targetZoneId,
      timestamp: Date.now(),
      state,
      score,
      density,
      avgSpeed,
      stopGoIndex,
      targetCount: c,
      entryCount: 14 + c,
      exitCount: 10,
      activeAlerts: c >= 10 ? ['CROWD_COMPRESSION_CRITICAL', 'VELOCITY_COLLAPSE'] : (c >= 5 ? ['VELOCITY_DROP'] : []),
      firmwareVersion: 'cpr-hybrid-v3.0'
    });

    broadcast('TELEMETRY_UPDATE', point);
    if (gate) broadcast('GATE_UPDATED', gate);
    broadcastSSE({ type: 'TELEMETRY_UPDATE', point, hardware: hardwareState, gates: storage.getGates() });

    return res.json({ status: 'ok', simulatedCount: c, gateId: targetGateId, hardware: hardwareState, gates: storage.getGates() });
  }

  if (action === 'start') {
    simulator.start();
  } else if (action === 'stop') {
    simulator.stop();
  } else if (action === 'tick') {
    simulator.generateTick();
  } else {
    if (simulator.isRunning) {
      simulator.stop();
    } else {
      simulator.start();
    }
  }

  broadcast('SIMULATOR_STATE', { isRunning: simulator.isRunning });
  res.json({ status: 'ok', simulatorRunning: simulator.isRunning });
});

// ----------------------------------------------------------------------------
// Health Check & Render Anti-Sleep Keep-Alive
// ----------------------------------------------------------------------------
const getHealthPayload = () => ({
  status: 'healthy',
  uptimeSeconds: Math.floor(process.uptime()),
  activeWebsockets: wss.clients.size,
  simulatorActive: simulator.isRunning,
  hardware: hardwareState,
  keepAlive: keepAliveEngine.getStats(),
  version: '3.0.0'
});

app.get('/health', (req, res) => res.json(getHealthPayload()));
app.get('/api/health', (req, res) => res.json(getHealthPayload()));

// Keep-Alive status and manual trigger endpoints
app.get('/api/keepalive', (req, res) => {
  res.json({
    status: 'ok',
    keepAlive: keepAliveEngine.getStats()
  });
});

app.post('/api/keepalive/ping', async (req, res) => {
  const result = await keepAliveEngine.ping(config.port);
  res.json({
    status: 'ok',
    triggered: true,
    keepAlive: result
  });
});

// Global Error Handler (never leak stack traces to clients)
app.use((err, req, res, _next) => {
  console.error('[EXPRESS ERROR]', err?.message || err);
  res.status(err?.status || 500).json({ error: 'Internal server error' });
});

// Start Server
server.listen(config.port, () => {
  keepAliveEngine.start(config.port);

  // Realistic ±5 sensor fluctuation loop for active non-zero gate counts (every 1.5s)
  setInterval(() => {
    const jittered = storage.tickSensorFluctuation();
    jittered.forEach(({ gate }) => {
      broadcast('GATE_UPDATED', gate);
      broadcastSSE({ type: 'GATE_UPDATED', gate });
    });
  }, 1500);

  console.log(`
============================================================
  CROWD PRESSURE RADAR - UNIFIED TELEMETRY & COMMAND BACKEND
============================================================
  HTTP & WebSocket Server: http://localhost:${config.port}
  Device Secret Key:       ${config.deviceKey}
  CORS Allowed Origin:     ${config.corsOrigin}
  Rate Limit:              ${config.rateLimitReqPerSec} req/sec per device
  ESP32 Status Endpoint:   http://localhost:${config.port}/api/esp32/status
  Live Stream (SSE):       http://localhost:${config.port}/api/stream
============================================================
`);
});


