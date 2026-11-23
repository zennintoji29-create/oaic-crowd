/**
 * CPR (Crowd Pressure Radar) - Multi-Page Telemetry Hub & Exhibition Server
 * Pure Node.js (Zero external dependencies)
 * 
 * Features:
 * - Default port 5050 with automatic EADDRINUSE conflict resolution.
 * - Primary Edge AI Vision telemetry receiver with Fruin LoS & Compressive Hazard tracking.
 * - Autonomous Degraded Mode Engine:
 *     * Ground Hardware: HLK-LD2410C radar + VL53L0X ToF + IR break-beam.
 *     * Single-file corridor gate (60-90 cm aperture).
 *     * IR & ToF measure throughput (PPM: people per minute).
 *     * Radar measures stationary human dwell time at the bottleneck gate.
 *     * Rolling baseline throughput (frozen during non-GREEN states).
 *     * Absolute stall floor (< 2.0 PPM).
 *     * Measured failover latency from exact first bad frame / gap.
 * - Real-time Server-Sent Events (SSE) broadcasting to Live Monitor & Hardware Demo Twin.
 * - ESP32 Direct Status REST endpoint for hardware polling.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

let PORT = parseInt(process.env.PORT || '5050', 10);

// Degraded Mode Configuration (matching CPR-AI/config.py)
const DEGRADED_CFG = {
  baselineWarmupSec: 60.0,
  initialBaselinePpm: 20.0,
  baselineAlpha: 0.05,
  absoluteMinPpm: 2.0,
  amberThroughputRatio: 0.40,
  redThroughputRatio: 0.15,
  amberDwellSec: 3.5,
  redDwellSec: 6.0
};

// Central System State
const state = {
  // Operational Mode: 'AI_VISION_PRIMARY' or 'HARDWARE_FAILOVER'
  systemMode: 'AI_VISION_PRIMARY',
  cameraOnline: true,
  lastCameraPing: Date.now(),
  firstBadCameraTime: null,
  lastMeasuredFailoverLatency: null,

  // Live Vision Metrics (YOLO + ByteTrack + Homography)
  vision: {
    deviceId: 'cpr-vision-gate-01',
    zoneId: 'zone-corridor-a',
    timestamp: Date.now(),
    state: 'GREEN',
    score: 0.15,
    density: 0.12,
    densityRaw: 0.12,
    densityUnit: 'people/m²',
    isCalibrated: true,
    groundAreaM2: 6.0,
    fruinLoS: 'LoS A (Free Flow)',
    avgSpeed: 48.5,
    stopGoIndex: 0.0,
    targetCount: 2,
    entryCount: 14,
    exitCount: 11,
    cameraHealth: 100.0,
    cameraHealthReason: 'SIGNAL_HEALTHY',
    isFailover: false,
    failoverLatencySec: null,
    activeAlerts: [],
    firmwareVersion: 'cpr-ai-v2.5-fruin'
  },

  // Degraded Mode Rolling Analytics (LD2410C + ToF + IR)
  degradedAnalytics: {
    baselineThroughputPpm: DEGRADED_CFG.initialBaselinePpm,
    currentThroughputPpm: 18.0,
    radarStationaryDwellSec: 0.0,
    isBaselineFrozen: false,
    degradedState: 'GREEN',
    lastIrCount: 14,
    lastIrTimestamp: Date.now()
  },

  // Physical ESP32 Sensor Hardware State (Breadboard 1 & 2)
  hardware: {
    esp32MasterOnline: true,
    esp32SlaveOnline: true,
    lastSeen: Date.now(),
    
    // Breadboard 1: Gate, HLK-LD2410C Radar, ToF, Master LoRa
    ld2410RadarPresence: false,
    ld2410Energy: 18,
    ld2410StationaryDwellSec: 0.0,
    tofDistanceMm: 1350,
    loraMasterRssi: -68,
    
    // Breadboard 2: IR Beam, Slave LoRa
    irBeamBroken: false,
    irBeamTriggerCount: 14,
    loraSlaveRssi: -72,

    // Traffic Light LEDs (Red, Yellow, Green)
    ledState: {
      red: false,
      yellow: false,
      green: true
    },

    // SG90 Servo Gate Actuator (Scale prototype for spring/gravity drop arm)
    servoAngle: 90, // 90 = Open, 45 = Metered, 0 = Closed/Lock
    servoStatus: 'OPEN',

    // Physical 0.96" I2C OLED Screen Content
    oledScreen: {
      line1: 'CPR CROWD RADAR',
      line2: 'COUNT: 2 PPL',
      line3: 'STATUS: NORMAL',
      line4: 'GATE: OPEN (90 DEG)'
    },

    buzzerActive: false
  },

  // System Event Logs
  eventLogs: [
    { timestamp: new Date().toLocaleTimeString(), type: 'INFO', msg: `CPR Multi-Component Telemetry Hub online.` }
  ]
};

// SSE Client Connections
const sseClients = new Set();

function broadcastSSE(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function logEvent(type, msg) {
  const entry = { timestamp: new Date().toLocaleTimeString(), type, msg };
  state.eventLogs.unshift(entry);
  if (state.eventLogs.length > 40) state.eventLogs.pop();
}

/**
 * Evaluates Degraded Mode Fallback Logic:
 * Single-file 60-90 cm gate. IR beam and ToF give throughput (PPM).
 * LD2410C radar detects stationary presence and dwell time at the gate aperture.
 */
function evaluateDegradedMode(currentPpm, dwellSec) {
  const da = state.degradedAnalytics;
  da.currentThroughputPpm = currentPpm;
  da.radarStationaryDwellSec = dwellSec;

  // Determine target state
  let targetState = 'GREEN';

  // Absolute stall floor rule: near-zero throughput with dwell is always a stall
  if (currentPpm < DEGRADED_CFG.absoluteMinPpm && dwellSec >= DEGRADED_CFG.amberDwellSec) {
    targetState = (dwellSec >= DEGRADED_CFG.redDwellSec) ? 'RED' : 'AMBER';
  } else {
    const ratio = currentPpm / Math.max(1.0, da.baselineThroughputPpm);
    if (ratio <= DEGRADED_CFG.redThroughputRatio || dwellSec >= DEGRADED_CFG.redDwellSec) {
      targetState = 'RED';
    } else if (ratio <= DEGRADED_CFG.amberThroughputRatio || dwellSec >= DEGRADED_CFG.amberDwellSec) {
      targetState = 'AMBER';
    } else {
      targetState = 'GREEN';
    }
  }

  // Freeze rolling baseline updates whenever state is not GREEN
  if (da.degradedState === 'GREEN' && targetState === 'GREEN') {
    da.baselineThroughputPpm = (DEGRADED_CFG.baselineAlpha * currentPpm) +
                               ((1.0 - DEGRADED_CFG.baselineAlpha) * da.baselineThroughputPpm);
    da.isBaselineFrozen = false;
  } else {
    da.isBaselineFrozen = true;
  }

  da.degradedState = targetState;
  return targetState;
}

// Evaluates LED Traffic Lights, SG90 Gate, and OLED Display based on Active Mode
function updateControlLogic() {
  let effectiveState = 'GREEN';
  let activeSource = 'CAMERA AI';
  let displayCount = 0;

  if (state.systemMode === 'AI_VISION_PRIMARY' && state.cameraOnline) {
    effectiveState = state.vision.state || 'GREEN';
    displayCount = state.vision.targetCount;
    activeSource = 'PRIMARY AI (YOLO11n + ByteTrack)';
  } else {
    // Degraded Mode (LD2410C Radar + ToF + IR Throughput)
    activeSource = 'DEGRADED FALLBACK (Radar + ToF + IR)';
    const ppm = state.degradedAnalytics.currentThroughputPpm;
    const dwell = state.hardware.ld2410StationaryDwellSec || state.degradedAnalytics.radarStationaryDwellSec;
    effectiveState = evaluateDegradedMode(ppm, dwell);
    displayCount = Math.max(1, Math.round(state.hardware.ld2410Energy / 10));
    state.vision.state = effectiveState;
  }

  // Actuator Safety State Enforcement
  if (effectiveState === 'RED') {
    state.hardware.ledState = { red: true, yellow: false, green: false };
    state.hardware.servoAngle = 0; // 0 degrees = Closed
    state.hardware.servoStatus = 'CLOSED (LOCKED)';
    state.hardware.buzzerActive = true;
    state.hardware.oledScreen = {
      line1: 'CPR: RED ALERT!',
      line2: `COUNT: ${displayCount} PPL`,
      line3: 'STATUS: CRITICAL CRUSH',
      line4: 'GATE: LOCKED (0D)'
    };
  } else if (effectiveState === 'AMBER') {
    state.hardware.ledState = { red: false, yellow: true, green: false };
    state.hardware.servoAngle = 45; // 45 degrees = Metered entry
    state.hardware.servoStatus = 'METERED (PARTIAL)';
    state.hardware.buzzerActive = false;
    state.hardware.oledScreen = {
      line1: 'CPR: WARNING',
      line2: `COUNT: ${displayCount} PPL`,
      line3: 'STATUS: ELEVATED FLOW',
      line4: 'GATE: METER (45D)'
    };
  } else {
    state.hardware.ledState = { red: false, yellow: false, green: true };
    state.hardware.servoAngle = 90; // 90 degrees = Open
    state.hardware.servoStatus = 'OPEN';
    state.hardware.buzzerActive = false;
    state.hardware.oledScreen = {
      line1: 'CPR RADAR: LIVE',
      line2: `COUNT: ${displayCount} PPL`,
      line3: 'STATUS: NORMAL FLOW',
      line4: 'GATE: OPEN (90D)'
    };
  }
}

// Watchdog timer: If camera doesn't ping for > 3.0 seconds, trigger automatic hardware failover!
setInterval(() => {
  const now = Date.now();
  const elapsed = now - state.lastCameraPing;

  if (elapsed > 3000 && state.cameraOnline && state.systemMode === 'AI_VISION_PRIMARY') {
    if (!state.firstBadCameraTime) {
      state.firstBadCameraTime = state.lastCameraPing;
    }
    const measuredLatencySec = ((now - state.firstBadCameraTime) / 1000).toFixed(2);
    state.lastMeasuredFailoverLatency = parseFloat(measuredLatencySec);
    state.cameraOnline = false;
    state.systemMode = 'HARDWARE_FAILOVER';

    logEvent('ALERT', `CAMERA STREAM OFFLINE — Automatic failover triggered to ESP32 Radar & ToF (Measured Failover Latency: ${measuredLatencySec}s).`);
    updateControlLogic();
    broadcastSSE({ type: 'FAILOVER_ALERT', state });
  }
}, 500);

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-source, x-device-key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. Ingest Telemetry (POST /api/telemetry)
  if (req.method === 'POST' && pathname === '/api/telemetry') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const headerSource = req.headers['x-source'] || '';
        const payloadSource = payload.source || '';
        const isVision = headerSource.includes('vision') || payloadSource.includes('vision') || payloadSource === 'computer_vision';
        const isEsp32 = headerSource.includes('esp32') || payloadSource.includes('esp32');

        if (isVision || (!isEsp32 && typeof payload.targetCount === 'number')) {
          const wasFailover = state.systemMode === 'HARDWARE_FAILOVER';
          state.vision = { ...state.vision, ...payload, timestamp: Date.now() };
          state.cameraOnline = true;
          state.lastCameraPing = Date.now();
          state.firstBadCameraTime = null;

          if (payload.isFailover) {
            state.systemMode = 'HARDWARE_FAILOVER';
            if (payload.failoverLatencySec) {
              state.lastMeasuredFailoverLatency = payload.failoverLatencySec;
            }
          } else if (wasFailover) {
            state.systemMode = 'AI_VISION_PRIMARY';
            logEvent('INFO', 'Camera stream restored. Primary AI Vision mode resumed after recovery verification.');
          }
        } else if (isEsp32) {
          state.hardware = { ...state.hardware, ...payload, lastSeen: Date.now() };
          // Calculate throughput from IR trigger delta if provided
          if (typeof payload.irBeamTriggerCount === 'number') {
            const dtMin = Math.max(0.01, (Date.now() - state.degradedAnalytics.lastIrTimestamp) / 60000.0);
            const dCount = Math.max(0, payload.irBeamTriggerCount - state.degradedAnalytics.lastIrCount);
            const calculatedPpm = dCount / dtMin;
            state.degradedAnalytics.lastIrCount = payload.irBeamTriggerCount;
            state.degradedAnalytics.lastIrTimestamp = Date.now();
            if (dtMin > 0.05) {
              state.degradedAnalytics.currentThroughputPpm = calculatedPpm;
            }
          }
          if (typeof payload.ld2410StationaryDwellSec === 'number') {
            state.degradedAnalytics.radarStationaryDwellSec = payload.ld2410StationaryDwellSec;
          }
        }

        updateControlLogic();
        broadcastSSE({ type: 'TELEMETRY_UPDATE', state });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', mode: state.systemMode }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // 2. Query Full State (GET /api/telemetry)
  if (req.method === 'GET' && pathname === '/api/telemetry') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(state));
  }

  // 3. ESP32 Direct Status Query (GET /api/esp32/status)
  if (req.method === 'GET' && pathname === '/api/esp32/status') {
    const isRed = state.hardware.ledState.red;
    const isYellow = state.hardware.ledState.yellow;
    const ledColor = isRed ? 'RED' : (isYellow ? 'YELLOW' : 'GREEN');
    
    const rgb = isRed 
      ? { r: 255, g: 0, b: 0 } 
      : (isYellow ? { r: 255, g: 180, b: 0 } : { r: 0, g: 255, b: 0 });

    const espResponse = {
      mode: state.systemMode,
      state: state.vision.state,
      count: state.vision.targetCount,
      fruinLoS: state.vision.fruinLoS,
      led: ledColor,
      rgb: rgb,
      ledPins: {
        red: isRed ? 1 : 0,
        yellow: isYellow ? 1 : 0,
        green: (!isRed && !isYellow) ? 1 : 0
      },
      servoAngle: state.hardware.servoAngle,
      servoStatus: state.hardware.servoStatus,
      buzzer: state.hardware.buzzerActive,
      oled: state.hardware.oledScreen
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(espResponse));
  }

  // 4. Toggle / Simulate Failover (POST /api/failover)
  if (req.method === 'POST' && pathname === '/api/failover') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = body ? JSON.parse(body) : {};
        if (typeof data.cameraOnline === 'boolean') {
          state.cameraOnline = data.cameraOnline;
        } else {
          state.cameraOnline = !state.cameraOnline;
        }

        const now = Date.now();
        if (!state.cameraOnline) {
          state.systemMode = 'HARDWARE_FAILOVER';
          state.lastMeasuredFailoverLatency = 1.50; // nominal simulation
          logEvent('ALERT', `Failover simulated: Degraded Mode active (LD2410C Radar + ToF).`);
        } else {
          state.systemMode = 'AI_VISION_PRIMARY';
          state.lastCameraPing = now;
          logEvent('INFO', `Primary AI Vision stream restored.`);
        }

        updateControlLogic();
        broadcastSSE({ type: 'MODE_CHANGE', state });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', state }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 4b. Interactive Demo Simulation Override (POST /api/simulate)
  if (req.method === 'POST' && pathname === '/api/simulate') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (typeof payload.count === 'number') {
          const c = Math.max(0, payload.count);
          state.vision.targetCount = c;
          state.vision.score = Math.min(1.0, c / 15.0);
          state.vision.density = Math.min(4.5, c / 6.0); // 6m²
          state.vision.avgSpeed = Math.max(5.0, 60.0 - c * 3.2);
          state.vision.stopGoIndex = c >= 10 ? 0.78 : (c >= 5 ? 0.35 : 0.05);

          if (state.vision.density >= 3.50) {
            state.vision.state = 'RED';
            state.vision.fruinLoS = 'CRUSH HAZARD (>3.5 p/m²)';
          } else if (state.vision.density >= 1.08) {
            state.vision.state = 'AMBER';
            state.vision.fruinLoS = 'LoS E (Shuffling Queue)';
          } else if (state.vision.density >= 0.72) {
            state.vision.state = 'AMBER';
            state.vision.fruinLoS = 'LoS D (Restricted Flow)';
          } else {
            state.vision.state = 'GREEN';
            state.vision.fruinLoS = 'LoS A-C (Normal Flow)';
          }

          state.hardware.ld2410Energy = Math.min(100, c * 7 + 12);
          state.hardware.ld2410RadarPresence = c > 0;
          state.hardware.tofDistanceMm = Math.max(280, 2000 - c * 95);
          state.lastCameraPing = Date.now();
        }
        if (typeof payload.cameraOnline === 'boolean') {
          state.cameraOnline = payload.cameraOnline;
          state.systemMode = payload.cameraOnline ? 'AI_VISION_PRIMARY' : 'HARDWARE_FAILOVER';
          logEvent('SIMULATION', `Mode forced to ${state.systemMode} via Interactive Demo`);
        }
        updateControlLogic();
        broadcastSSE({ type: 'SIMULATION_UPDATE', state });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', state }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 5. Server-Sent Events (GET /api/stream)
  if (req.method === 'GET' && pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify({ type: 'INITIAL_STATE', state })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // 6. Static File Serving
  let targetFile = 'index.html';
  if (pathname === '/demo') {
    targetFile = 'demo.html';
  } else if (pathname !== '/') {
    targetFile = pathname.replace(/^\//, '');
  }

  const filePath = path.join(__dirname, 'public', targetFile);
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Page Not Found');
    }
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'text/javascript';
    if (ext === '.css') contentType = 'text/css';
    if (ext === '.json') contentType = 'application/json';
    if (ext === '.png') contentType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

function startServer(portToTry) {
  server.listen(portToTry, () => {
    PORT = portToTry;
    console.log('='.repeat(65));
    console.log(`  CPR (Crowd Pressure Radar) Telemetry Hub & Multi-Page Server`);
    console.log(`  - Live Monitor Dashboard:   http://localhost:${PORT}/`);
    console.log(`  - Interactive Demo Sandbox: http://localhost:${PORT}/demo`);
    console.log(`  - ESP32 Direct Status API:  http://localhost:${PORT}/api/esp32/status`);
    console.log(`  - Telemetry Ingest:         http://localhost:${PORT}/api/telemetry`);
    console.log('='.repeat(65));
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[CPR-Hub] Port ${PORT} is in use. Retrying on port ${PORT + 1}...`);
    startServer(PORT + 1);
  } else {
    console.error('[CPR-Hub] Server error:', err);
  }
});

startServer(PORT);
