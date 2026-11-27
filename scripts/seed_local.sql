-- =============================================================================
--  @license MIT
--  @project UMBRAL — Private Perimeter & Incident Observatory
--  @module  scripts/seed_local.sql
--
--  Copyright (c) 2026 UMBRAL Contributors. All rights reserved.
--
--  This source code is licensed under the MIT License found in the
--  LICENSE file in the root directory of this source tree.
--
--  SPDX-License-Identifier: MIT
-- =============================================================================

-- Datos de demostración opcionales SOLO para desarrollo local (`pnpm db:seed:local`)
-- Nunca se ejecuta en producción.

INSERT OR REPLACE INTO site_runtime_state
  (site_id, consecutive_failures, last_status, last_checked_at, last_cf_sync_at, last_vercel_sync_at, last_vercel_deployment_id, last_vercel_deployment_state)
VALUES
  ('mi-web-principal', 0, 'up', datetime('now', '-1 minutes'), datetime('now', '-3 minutes'), datetime('now', '-3 minutes'), 'dpl_demo_001', 'READY'),
  ('mi-app', 0, 'degraded', datetime('now', '-1 minutes'), datetime('now', '-3 minutes'), datetime('now', '-3 minutes'), 'dpl_demo_002', 'READY');

INSERT INTO uptime_checks (site_id, checked_at, ok, status_code, latency_ms, security_score, missing_headers) VALUES
  ('mi-web-principal', datetime('now', '-30 minutes'), 1, 200, 148, 100, '[]'),
  ('mi-web-principal', datetime('now', '-10 minutes'), 1, 200, 132, 100, '[]'),
  ('mi-app', datetime('now', '-30 minutes'), 1, 200, 310, 75, '["content-security-policy"]'),
  ('mi-app', datetime('now', '-10 minutes'), 1, 200, 2640, 75, '["content-security-policy"]');

INSERT OR REPLACE INTO incidents
  (id, site_id, fingerprint, category, severity, source, status, title, description, occurrences, started_at, last_seen_at, resolved_at, metadata_json)
VALUES
  (
    'inc_demo_waf_01',
    'mi-web-principal',
    'cf-waf-spike:mi-web-principal',
    'attack',
    'high',
    'cloudflare-waf',
    'open',
    'Pico de escaneo bloqueado por Cloudflare WAF',
    'Cloudflare bloqueó 18 peticiones automatizadas hacia /.env y /wp-login.php.',
    18,
    datetime('now', '-14 minutes'),
    datetime('now', '-2 minutes'),
    NULL,
    '{"topIps":["203.0.113.42","198.51.100.19"],"topPaths":["/.env","/wp-login.php"],"actions":{"block":15,"managed_challenge":3}}'
  ),
  (
    'inc_demo_latency_02',
    'mi-app',
    'latency:mi-app',
    'downtime',
    'medium',
    'uptime-probe',
    'investigating',
    'Latencia elevada en App / Portal (2640 ms)',
    'El tiempo de respuesta superó el umbral de 2500 ms en el último chequeo.',
    2,
    datetime('now', '-10 minutes'),
    datetime('now', '-2 minutes'),
    NULL,
    '{"latencyMs":2640,"thresholdMs":2500,"statusCode":200}'
  );

INSERT OR REPLACE INTO security_events
  (id, site_id, occurred_at, source, action, rule_id, rule_source, client_ip, country, host, path, method, user_agent, metadata_json)
VALUES
  ('ev_demo_01', 'mi-web-principal', datetime('now', '-2 minutes'), 'cloudflare-waf', 'block', 'waf-env-probe', 'firewallManaged', '203.0.113.42', 'DE', 'ejemplo.com', '/.env', 'GET', 'curl/8.4.0', '{}'),
  ('ev_demo_02', 'mi-app', datetime('now', '-6 minutes'), 'cloudflare-waf', 'managed_challenge', 'bot-fight', 'bic', '198.51.100.19', 'SG', 'app.ejemplo.com', '/api/search', 'GET', 'python-requests/2.31', '{}');
