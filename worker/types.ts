export type IncidentCategory =
  | "downtime"
  | "attack"
  | "block"
  | "security"
  | "error"
  | "deployment";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";

export type IncidentStatus = "open" | "investigating" | "resolved";

export type IncidentSource =
  | "uptime-probe"
  | "cloudflare-waf"
  | "cloudflare-http"
  | "vercel-api"
  | "app-sdk";

export type SiteOperationalStatus =
  | "up"
  | "degraded"
  | "down"
  | "under_attack"
  | "unknown";

export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  ENVIRONMENT?: string;
  RETENTION_DAYS?: string;
  DASHBOARD_ADMIN_EMAIL?: string;
  DASHBOARD_API_KEY?: string;
  CLOUDFLARE_API_TOKEN?: string;
  VERCEL_API_TOKEN?: string;
  SITE_SECRETS_JSON?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  DISCORD_WEBHOOK_URL?: string;
}

export interface IncidentRow {
  id: string;
  site_id: string;
  fingerprint: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  source: IncidentSource;
  status: IncidentStatus;
  title: string;
  description: string;
  occurrences: number;
  started_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  metadata_json: string;
}

export interface UptimeCheckRow {
  id: number;
  site_id: string;
  checked_at: string;
  ok: number;
  status_code: number | null;
  latency_ms: number;
  error_message: string | null;
  cf_ray: string | null;
  security_score: number;
  missing_headers: string | null;
}

export interface SecurityEventRow {
  id: string;
  site_id: string;
  occurred_at: string;
  source: string;
  action: string;
  rule_id: string | null;
  rule_source: string | null;
  client_ip: string | null;
  country: string | null;
  host: string | null;
  path: string | null;
  method: string | null;
  user_agent: string | null;
  metadata_json: string;
}

export interface SiteRuntimeStateRow {
  site_id: string;
  consecutive_failures: number;
  last_status: SiteOperationalStatus;
  last_checked_at: string | null;
  last_cf_sync_at: string | null;
  last_vercel_sync_at: string | null;
  last_vercel_deployment_id: string | null;
  last_vercel_deployment_state: string | null;
}
