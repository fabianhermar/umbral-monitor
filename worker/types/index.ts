/**
 * ============================================================================
 * Tipos y contratos centrales del Backend (Cloudflare Worker + D1)
 * ============================================================================
 * Centraliza todas las definiciones de datos para que rutas, servicios,
 * repositorios y recolectores compartan exactamente los mismos tipos.
 */

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

export interface AuthContext {
  mode: "cloudflare-access" | "api-key" | "development" | "demo";
  user: string;
}

/**
 * Variables de entorno y bindings inyectados por Cloudflare Workers.
 * Los secretos sensibles se configuran con `wrangler secret put <NOMBRE>`.
 */
export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  ENVIRONMENT?: string;
  DEMO_MODE?: string;
  RETENTION_DAYS?: string;

  // Autenticación del Dashboard
  DASHBOARD_ADMIN_EMAIL?: string;
  DASHBOARD_API_KEY?: string;
  CF_ACCESS_TEAM_DOMAIN?: string; // ej. "mi-equipo.cloudflareaccess.com"
  CF_ACCESS_AUD?: string;         // Audience (AUD) Tag de la aplicación en Cloudflare Zero Trust

  // Integraciones de lectura (APIs externas)
  CLOUDFLARE_API_TOKEN?: string;
  VERCEL_API_TOKEN?: string;

  // Lista blanca privada opcional por secreto (sobrescribe config/sites.config.ts)
  SITES_CONFIG_JSON?: string;

  // Secretos HMAC por sitio para /api/ingest
  SITE_SECRETS_JSON?: string;

  // Canales de alerta opcionales
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
  muted_until: string | null;
}

export interface IncidentNoteRow {
  id: string;
  incident_id: string;
  author: string;
  content: string;
  created_at: string;
}
