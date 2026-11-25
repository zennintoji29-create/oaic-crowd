import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  deviceKey: process.env.DEVICE_KEY || 'cpr-secret-key-2026',
  corsOrigin: process.env.CORS_ORIGIN || 'https://oaic-crowd.vercel.app',
  jwtSecret: process.env.JWT_SECRET || '',
  masterPinHash: process.env.MASTER_PIN_HASH || '',
  masterKeyHash: process.env.MASTER_KEY_HASH || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '',
  dataDir: process.env.DATA_DIR || './data',
  rateLimitReqPerSec: parseInt(process.env.RATE_LIMIT_REQ_PER_SEC || '10', 10),
  historyRetentionMinutes: 10,
  maxPointsPerZone: 1000,
  commandExpiryMs: 30000 // 30 seconds
};
