-- =============================================================================
--  @license MIT
--  @project UMBRAL — Private Perimeter & Incident Observatory
--  @module  migrations/0001_initial.sql
--
--  Copyright (c) 2026 UMBRAL Contributors. All rights reserved.
--
--  This source code is licensed under the MIT License found in the
--  LICENSE file in the root directory of this source tree.
--
--  SPDX-License-Identifier: MIT
-- =============================================================================

-- ============================================================================
-- Esquema D1 (SQLite) para el Dashboard Privado de Incidencias
-- ============================================================================

-- 1. Chequeos de disponibilidad, latencia y cabeceras de seguridad (cada 1 min)
CREATE TABLE IF NOT EXISTS uptime_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  ok INTEGER NOT NULL,                 -- 1 = UP, 0 = DOWN
  status_code INTEGER,
  latency_ms INTEGER NOT NULL,
  error_message TEXT,
  cf_ray TEXT,
  security_score INTEGER DEFAULT 100,  -- 0-100 basado en cabeceras HSTS/CSP/XCTO/XFO
  missing_headers TEXT                 -- JSON array de cabeceras faltantes
);

CREATE INDEX IF NOT EXISTS idx_uptime_site_time
  ON uptime_checks (site_id, checked_at DESC);

-- 2. Incidencias unificadas (caídas, ataques, bloqueos, seguridad, errores app, deploys)
CREATE TABLE IF NOT EXISTS incidents (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL,           -- Clave de deduplicación para agrupar eventos repetidos
  category TEXT NOT NULL,              -- 'downtime' | 'attack' | 'block' | 'security' | 'error' | 'deployment'
  severity TEXT NOT NULL,              -- 'low' | 'medium' | 'high' | 'critical'
  source TEXT NOT NULL,                -- 'uptime-probe' | 'cloudflare-waf' | 'cloudflare-http' | 'vercel-api' | 'app-sdk'
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'investigating' | 'resolved'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  occurrences INTEGER NOT NULL DEFAULT 1,
  started_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  resolved_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_incidents_status_time
  ON incidents (status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_incidents_site_fingerprint
  ON incidents (site_id, fingerprint, status);

-- 3. Eventos detallados de seguridad / firewall (Cloudflare WAF, DDoS, Rate Limit, App blocks)
CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,                 -- Hash / rayId para evitar duplicados al hacer polling
  site_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  source TEXT NOT NULL,                -- 'cloudflare-waf' | 'app-sdk'
  action TEXT NOT NULL,                -- 'block' | 'managed_challenge' | 'jschallenge' | 'challenge' | 'log' | 'rate_limit'
  rule_id TEXT,
  rule_source TEXT,                    -- 'firewallManaged' | 'l7ddos' | 'ratelimit' | 'bic' | 'securitylevel' | etc.
  client_ip TEXT,
  country TEXT,
  host TEXT,
  path TEXT,
  method TEXT,
  user_agent TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sec_events_site_time
  ON security_events (site_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_sec_events_ip
  ON security_events (client_ip, occurred_at DESC);

-- 4. Estado operativo ligero por sitio (para histéresis de fallos consecutivos y sincronización)
CREATE TABLE IF NOT EXISTS site_runtime_state (
  site_id TEXT PRIMARY KEY,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_status TEXT NOT NULL DEFAULT 'unknown', -- 'up' | 'degraded' | 'down' | 'under_attack' | 'unknown'
  last_checked_at TEXT,
  last_cf_sync_at TEXT,
  last_vercel_sync_at TEXT,
  last_vercel_deployment_id TEXT,
  last_vercel_deployment_state TEXT
);
