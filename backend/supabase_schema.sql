-- Crowd Pressure Radar (CPR) - Supabase PostgreSQL Schema
-- Paste and run this in your Supabase SQL Editor

create table if not exists cpr_operators (
  email text primary key,
  phone text not null,
  password_hash text not null,
  setup_complete boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists cpr_gate_states (
  id text primary key,
  name text not null,
  zone_id text not null,
  status text not null default 'GREEN',
  count integer not null default 0,
  density double precision not null default 0,
  risk_score double precision not null default 0,
  servo_angle integer not null default 90,
  servo_status text not null default 'OPEN',
  is_manual_override boolean not null default false,
  manual_state text not null default 'AUTO',
  power boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists cpr_telemetry_logs (
  id bigint generated always as identity primary key,
  device_id text not null,
  zone_id text not null,
  state text not null,
  score double precision not null default 0,
  density double precision not null default 0,
  avg_speed double precision not null default 0,
  stop_go_index double precision not null default 0,
  target_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_cpr_telemetry_zone_time
  on cpr_telemetry_logs (zone_id, created_at desc);

create table if not exists cpr_alerts (
  id text primary key,
  zone_id text not null,
  zone_name text not null,
  from_state text not null,
  to_state text not null,
  score double precision not null default 0,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists cpr_system_config (
  id text primary key,
  config_json jsonb not null,
  updated_at timestamptz not null default now()
);
