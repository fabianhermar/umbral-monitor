/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  src/types/dashboard.types.ts
 *
 * Copyright (c) 2026 UMBRAL Contributors. All rights reserved.
 *
 * This source code is licensed under the MIT License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * SPDX-License-Identifier: MIT
 */

/**
 * ============================================================================
 * Contratos de Datos del Frontend (`UMBRAL`)
 * ============================================================================
 * Refleja exactamente las respuestas JSON devueltas por `/api/dashboard/*`.
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
export type SiteOperationalStatus = "up" | "degraded" | "down" | "under_attack" | "unknown";
export type ThemeMode = "obsidian" | "alabaster";
export type NavSection = "pulse" | "incidents" | "perimeter" | "telemetry";

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
  mutedUntil?: string | null;
  slaBudgetRemainingPct?: number;
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
  isDemo?: boolean;
  auth: {
    mode: "cloudflare-access" | "api-key" | "development" | "demo";
    user: string;
  };
  integrations: {
    cloudflareConfigured: boolean;
    vercelConfigured: boolean;
    telegramConfigured: boolean;
    discordConfigured: boolean;
    ingestSecretsConfigured: boolean;
    cfAccessVerifiedConfigured?: boolean;
  };
  kpis: {
    totalSites: number;
    globalUptime24h: number | null;
    globalAvgLatencyMs: number | null;
    openIncidents: number;
    criticalIncidents: number;
    securityEvents24h: number;
    mttrMinutes30d?: number | null;
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

export interface IncidentFilters {
  status: string;
  category: string;
  severity: string;
}

export interface DemoProbeResult {
  requestedUrl: string;
  finalUrl: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  server: string | null;
  cfRay: string | null;
  securityScore: number;
  presentHeaders: string[];
  missingHeaders: string[];
  downgradedToHttp: boolean;
  error?: string;
}

export interface IncidentNote {
  id: string;
  incident_id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface SiteDeepDiagnostics {
  siteId: string;
  domain: string;
  checkedAt: string;
  httpToHttpsRedirect: {
    enforced: boolean;
    statusCode: number | null;
    location: string | null;
  };
  httpsProbe: {
    ok: boolean;
    finalUrl: string;
    statusCode: number | null;
    latencyMs: number;
    server: string | null;
    cfRay: string | null;
    error?: string;
  };
  headersAudit: {
    score: number;
    headers: Array<{ name: string; present: boolean; valuePreview: string | null }>;
  };
  dns: {
    aRecords: string[];
    aaaaRecords: string[];
    caaRecords: string[];
    hasSpfOrDmarc: boolean;
  };
  hasSecurityTxt: boolean;
}
