-- Datos de demostración opcionales SOLO para desarrollo local (`pnpm db:seed:local`)
-- Nunca se ejecuta en producción.

INSERT OR REPLACE INTO site_runtime_state
  (site_id, consecutive_failures, last_status, last_checked_at, last_cf_sync_at, last_vercel_sync_at, last_vercel_deployment_id, last_vercel_deployment_state)
VALUES
  ('boxode', 0, 'up', datetime('now', '-1 minutes'), datetime('now', '-3 minutes'), datetime('now', '-3 minutes'), 'dpl_demo_boxode', 'READY'),
  ('carniceriasnmiguel', 0, 'up', datetime('now', '-1 minutes'), datetime('now', '-3 minutes'), datetime('now', '-3 minutes'), 'dpl_demo_csm', 'READY'),
  ('ccut', 0, 'degraded', datetime('now', '-1 minutes'), datetime('now', '-3 minutes'), datetime('now', '-3 minutes'), 'dpl_demo_ccut', 'READY'),
  ('duneui', 0, 'up', datetime('now', '-1 minutes'), datetime('now', '-3 minutes'), datetime('now', '-3 minutes'), 'dpl_demo_duneui', 'READY'),
  ('fabianh', 0, 'up', datetime('now', '-1 minutes'), datetime('now', '-3 minutes'), datetime('now', '-3 minutes'), 'dpl_demo_fabianh', 'READY');

INSERT INTO uptime_checks (site_id, checked_at, ok, status_code, latency_ms, security_score, missing_headers) VALUES
  ('boxode', datetime('now', '-30 minutes'), 1, 200, 148, 100, '[]'),
  ('boxode', datetime('now', '-10 minutes'), 1, 200, 132, 100, '[]'),
  ('carniceriasnmiguel', datetime('now', '-30 minutes'), 1, 200, 194, 75, '["content-security-policy"]'),
  ('carniceriasnmiguel', datetime('now', '-10 minutes'), 1, 200, 185, 75, '["content-security-policy"]'),
  ('ccut', datetime('now', '-30 minutes'), 1, 200, 310, 100, '[]'),
  ('ccut', datetime('now', '-10 minutes'), 1, 200, 2640, 100, '[]'),
  ('duneui', datetime('now', '-30 minutes'), 1, 200, 118, 100, '[]'),
  ('duneui', datetime('now', '-10 minutes'), 1, 200, 125, 100, '[]'),
  ('fabianh', datetime('now', '-30 minutes'), 1, 200, 141, 100, '[]'),
  ('fabianh', datetime('now', '-10 minutes'), 1, 200, 137, 100, '[]');

INSERT OR REPLACE INTO incidents
  (id, site_id, fingerprint, category, severity, source, status, title, description, occurrences, started_at, last_seen_at, resolved_at, metadata_json)
VALUES
  (
    'inc_demo_waf_boxode',
    'boxode',
    'cf-waf-spike:boxode',
    'attack',
    'high',
    'cloudflare-waf',
    'open',
    'Pico de escaneo bloqueado por Cloudflare WAF (boxode.org)',
    'Cloudflare bloqueó 18 peticiones automatizadas hacia /.env y /wp-login.php.',
    18,
    datetime('now', '-14 minutes'),
    datetime('now', '-2 minutes'),
    NULL,
    '{"topIps":["185.220.101.42","45.155.205.91"],"topPaths":["/.env","/wp-login.php"],"actions":{"block":15,"managed_challenge":3}}'
  ),
  (
    'inc_demo_latency_ccut',
    'ccut',
    'latency:ccut',
    'downtime',
    'medium',
    'uptime-probe',
    'investigating',
    'Latencia elevada en CCUT (2640 ms)',
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
  ('ev_demo_boxode_1', 'boxode', datetime('now', '-2 minutes'), 'cloudflare-waf', 'block', 'waf-env-probe', 'firewallManaged', '185.220.101.42', 'DE', 'boxode.org', '/.env', 'GET', 'curl/8.4.0', '{}'),
  ('ev_demo_duneui_1', 'duneui', datetime('now', '-6 minutes'), 'cloudflare-waf', 'managed_challenge', 'bot-fight', 'bic', '103.21.244.12', 'SG', 'duneui.dev', '/api/search', 'GET', 'python-requests/2.31', '{}'),
  ('ev_demo_fabianh_1', 'fabianh', datetime('now', '-8 minutes'), 'cloudflare-waf', 'block', 'waf-wp-scan', 'firewallManaged', '45.155.205.91', 'NL', 'fabianh.me', '/wp-login.php', 'POST', 'Go-http-client/2.0', '{}');
