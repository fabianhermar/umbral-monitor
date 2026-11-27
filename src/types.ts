export type IncidentCategory =
  | "downtime"
  | "attack"
  | "block"
  | "security"
  | "error"
  | "deployment";

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "resolved";
export type SiteOperationalStatus = "up" | "degraded" | "down" | "under_attack" | "unknown";

export interface UptimeBarPoint {
  checkedAt: string;
  ok: boolean;
  latencyMs: number;
  statusCode: number | null;
}

export interface SiteSummary {
  id: string;
  name: string;
  domain: string;
  allowedHosts: string[];
  checkUrl: string;
  status: SiteOperationalStatus;
  uptime24h: number | null;
  avgLatencyMs: number | null;
  lastLatencyMs: number | null;
  lastStatusCode: number | null;
  lastCheckedAt: string | null;
  securityScore: number;
  openIncidentsCount: number;
  securityEvents24h: number;
  hasCloudflareZone: boolean;
  hasVercelProject: boolean;
  lastVercelState: string | null;
  recentBars: UptimeBarPoint[];
}

export interface OverviewResponse {
  auth: {
    mode: "cloudflare-access" | "api-key" | "development";
    user: string;
  };
  integrations: {
    cloudflareConfigured: boolean;
    vercelConfigured: boolean;
    telegramConfigured: boolean;
    discordConfigured: boolean;
    ingestSecretsConfigured: boolean;
  };
  kpis: {
    totalSites: number;
    globalUptime24h: number | null;
    globalAvgLatencyMs: number | null;
    openIncidents: number;
    criticalIncidents: number;
    securityEvents24h: number;
  };
  sites: SiteSummary[];
}

export interface IncidentItem {
  id: string;
  site_id: string;
  fingerprint: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  source: string;
  status: IncidentStatus;
  title: string;
  description: string;
  occurrences: number;
  started_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  metadata: Record<string, unknown>;
}

export interface SecurityEventItem {
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
}

export interface SecurityResponse {
  events: SecurityEventItem[];
  topIps: Array<{ ip: string; country: string | null; count: number }>;
  actionsBreakdown: Array<{ action: string; count: number }>;
  topPaths: Array<{ path: string; count: number }>;
}

export interface UptimePoint {
  site_id: string;
  checked_at: string;
  ok: number;
  status_code: number | null;
  latency_ms: number;
}
