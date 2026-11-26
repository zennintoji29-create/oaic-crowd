import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

let supabase = null;

if (config.supabaseUrl && config.supabaseServiceKey) {
  try {
    supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    console.log('[SUPABASE] Client initialized for', config.supabaseUrl);
  } catch (err) {
    console.warn('[SUPABASE] Initialization failed, using local storage:', err.message);
    supabase = null;
  }
} else {
  console.log('[SUPABASE] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — running with local storage fallback.');
}

export function isSupabaseEnabled() {
  return supabase !== null;
}

export async function dbUpsertOperator(user) {
  if (!supabase || !user?.email) return;
  try {
    await supabase.from('cpr_operators').upsert(
      {
        email: user.email,
        phone: user.phone || '',
        password_hash: user.passwordHash,
        setup_complete: Boolean(user.setupComplete),
        created_at: new Date(user.createdAt || Date.now()).toISOString()
      },
      { onConflict: 'email' }
    );
  } catch (err) {
    console.warn('[SUPABASE] dbUpsertOperator failed:', err.message);
  }
}

export async function dbDeleteOperator(email) {
  if (!supabase || !email) return;
  try {
    await supabase.from('cpr_operators').delete().eq('email', email);
  } catch (err) {
    console.warn('[SUPABASE] dbDeleteOperator failed:', err.message);
  }
}

export async function dbLoadOperators() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase.from('cpr_operators').select('*');
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => ({
      email: row.email,
      phone: row.phone || '',
      passwordHash: row.password_hash,
      setupComplete: Boolean(row.setup_complete),
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    }));
  } catch (err) {
    console.warn('[SUPABASE] dbLoadOperators failed:', err.message);
    return [];
  }
}

export async function dbInsertTelemetry(point) {
  if (!supabase || !point) return;
  try {
    await supabase.from('cpr_telemetry_logs').insert({
      device_id: point.deviceId,
      zone_id: point.zoneId,
      state: point.state,
      score: Number(point.score || 0),
      density: Number(point.density || 0),
      avg_speed: Number(point.avgSpeed || 0),
      stop_go_index: Number(point.stopGoIndex || 0),
      target_count: Number(point.targetCount || 0),
      created_at: new Date(point.serverTimestamp || point.timestamp || Date.now()).toISOString()
    });
  } catch (err) {
    console.warn('[SUPABASE] dbInsertTelemetry failed:', err.message);
  }
}

export async function dbInsertAlert(alert) {
  if (!supabase || !alert) return;
  try {
    await supabase.from('cpr_alerts').upsert({
      id: alert.id,
      zone_id: alert.zoneId,
      zone_name: alert.zoneName,
      from_state: alert.fromState,
      to_state: alert.toState,
      score: Number(alert.score || 0),
      message: alert.message,
      created_at: new Date(alert.timestamp || Date.now()).toISOString()
    });
  } catch (err) {
    console.warn('[SUPABASE] dbInsertAlert failed:', err.message);
  }
}

export async function dbLoadAlerts(limit = 100) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('cpr_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    return data.map((row) => ({
      id: row.id,
      zoneId: row.zone_id,
      zoneName: row.zone_name,
      fromState: row.from_state,
      toState: row.to_state,
      score: row.score,
      message: row.message,
      timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now()
    }));
  } catch (err) {
    console.warn('[SUPABASE] dbLoadAlerts failed:', err.message);
    return [];
  }
}

export async function dbUpsertGate(gate) {
  if (!supabase || !gate?.id) return;
  try {
    await supabase.from('cpr_gate_states').upsert(
      {
        id: gate.id,
        name: gate.name,
        zone_id: gate.zoneId,
        status: gate.status,
        count: Number(gate.count || 0),
        density: Number(gate.density || 0),
        risk_score: Number(gate.riskScore || 0),
        servo_angle: Number(gate.servoAngle ?? 90),
        servo_status: gate.servoStatus || 'OPEN',
        is_manual_override: Boolean(gate.isManualOverride),
        manual_state: gate.manualState || 'AUTO',
        power: Boolean(gate.power),
        updated_at: new Date(gate.lastUpdated || Date.now()).toISOString()
      },
      { onConflict: 'id' }
    );
  } catch (err) {
    console.warn('[SUPABASE] dbUpsertGate failed:', err.message);
  }
}

export async function dbUpsertSystemConfig(cfg) {
  if (!supabase || !cfg) return;
  try {
    await supabase.from('cpr_system_config').upsert(
      {
        id: 'default',
        config_json: cfg,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    );
  } catch (err) {
    console.warn('[SUPABASE] dbUpsertSystemConfig failed:', err.message);
  }
}
