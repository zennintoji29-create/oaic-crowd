import { z } from 'zod';

export const TelemetrySchema = z.object({
  deviceId: z.string().min(1),
  zoneId: z.string().min(1),
  timestamp: z.coerce.number().int().positive(),
  state: z.enum(['GREEN', 'AMBER', 'RED']),
  score: z.coerce.number().min(0).max(100),
  density: z.coerce.number().min(0),
  avgSpeed: z.coerce.number().min(0),
  stopGoIndex: z.coerce.number().min(0),
  targetCount: z.coerce.number().int().min(0),
  entryCount: z.coerce.number().int().min(0),
  exitCount: z.coerce.number().int().min(0),
  activeAlerts: z.array(z.string()).default([]),
  firmwareVersion: z.string().default('1.0.0')
});

export const CommandSchema = z.object({
  deviceId: z.string().min(1),
  command: z.enum(['MANUAL_GATE_OPEN', 'MANUAL_GATE_CLOSE', 'SILENCE_BUZZER', 'RESET_ZONE']),
  reason: z.string().optional()
});

export const ZoneConfigSchema = z.object({
  zoneId: z.string().min(1),
  name: z.string().min(1),
  areaSqM: z.coerce.number().positive(),
  corridorWidthM: z.coerce.number().positive()
});

export const HardwareRegisterSchema = z.object({
  deviceId: z.string().min(1).max(64),
  zoneId: z.string().min(1).max(64).default('zone-entry-a'),
  role: z.enum(['MASTER_ACTUATOR', 'TRANSMITTER_SENSOR']).default('MASTER_ACTUATOR'),
  firmwareVersion: z.string().min(1).max(32).default('4.0.0'),
  ip: z.string().max(64).optional(),
  capabilities: z.array(z.string()).default([])
});

export const HardwareHeartbeatSchema = z.object({
  deviceId: z.string().min(1).max(64),
  zoneId: z.string().min(1).max(64).default('zone-entry-a'),
  uptimeSec: z.coerce.number().int().min(0).default(0),
  wifiRssi: z.coerce.number().int().min(-120).max(0).optional(),
  firmwareVersion: z.string().min(1).max(32).optional(),
  sensors: z.object({
    presenceDetected: z.boolean().nullable().optional(),
    radarEnergy: z.coerce.number().min(0).max(100).nullable().optional(),
    radarOnline: z.boolean().optional(),
    tofDistanceMm: z.coerce.number().int().min(0).max(8000).nullable().optional(),
    tofOnline: z.boolean().optional(),
    irCount: z.coerce.number().int().min(0).nullable().optional()
  }).optional(),
  reportedOutputs: z.object({
    alertLevel: z.enum(['GREEN', 'AMBER', 'RED', 'SAFE']).optional(),
    led: z.enum(['GREEN', 'AMBER', 'RED', 'SAFE']).optional(),
    buzzer: z.enum(['OFF', 'WARNING_BEEPS', 'CRITICAL_ALARM']).optional(),
    servoAngle: z.coerce.number().int().min(0).max(180).optional(),
    lastAckSeq: z.coerce.number().int().min(0).optional()
  }).optional()
});

export const HardwareAckSchema = z.object({
  deviceId: z.string().min(1).max(64),
  seq: z.coerce.number().int().min(1),
  nonce: z.string().max(64).optional(),
  command: z.string().min(1).max(64),
  status: z.enum(['APPLIED', 'REJECTED_DUPLICATE', 'TIMEOUT', 'ERROR']),
  reportedOutputs: z.object({
    alertLevel: z.enum(['GREEN', 'AMBER', 'RED', 'SAFE']).optional(),
    led: z.enum(['GREEN', 'AMBER', 'RED', 'SAFE']).optional(),
    buzzer: z.enum(['OFF', 'WARNING_BEEPS', 'CRITICAL_ALARM']).optional(),
    servoAngle: z.coerce.number().int().min(0).max(180).optional()
  }).optional()
});

export const HardwareModeSchema = z.object({
  mode: z.enum(['AI_CAMERA', 'HARDWARE_FALLBACK', 'COMBINED_DEMO'])
});

export const HardwareDemoSchema = z.object({
  action: z.enum(['SET_ALERT', 'RESET']),
  alertLevel: z.enum(['GREEN', 'AMBER', 'RED']).optional()
});

export const HardwareCommandSchema = z.object({
  deviceId: z.string().min(1).max(64).default('cpr-esp32-master-01'),
  type: z.enum(['GATE_OPEN', 'GATE_CLOSE', 'GATE_METER', 'SERVO_TEST', 'GATE_RESET', 'BUZZER_OFF', 'SYNC_ALERT']),
  alertLevel: z.enum(['GREEN', 'AMBER', 'RED']).optional(),
  servoAngle: z.coerce.number().int().min(0).max(180).optional()
});
