/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  worker/demo/demo.data.ts
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
 * Motor de Datos Ficticios — Modo Demo Público (`DEMO_MODE=true`)
 * ============================================================================
 * Contiene únicamente dominios ficticios (`.demo`) e IPs de documentación
 * RFC 5737 (`192.0.2.x`, `198.51.100.x`, `203.0.113.x`).
 * Jamás importa `config/sites.config.ts` ni accede a la base de datos D1 real.
 */

import type {
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  SiteOperationalStatus,
} from "../types";

export interface DemoSiteSeed {
  id: string;
  name: string;
  domain: string;
  allowedHosts: string[];
  checkUrl: string;
  baseLatencyMs: number;
  securityScore: number;
  lastVercelState: string;
}

export interface DemoIncident {
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

export interface DemoSecurityEvent {
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

export const DEMO_SITES: readonly DemoSiteSeed[] = [
  {
    id: "nova-web",
    name: "Nova Cloud",
    domain: "nova-cloud.demo",
    allowedHosts: ["nova-cloud.demo", "www.nova-cloud.demo"],
    checkUrl: "https://example.com",
    baseLatencyMs: 138,
    securityScore: 100,
    lastVercelState: "READY",
  },
  {
    id: "nova-api",
    name: "Nova Core API",
    domain: "api.nova-cloud.demo",
    allowedHosts: ["api.nova-cloud.demo"],
    checkUrl: "https://example.com",
    baseLatencyMs: 215,
    securityScore: 100,
    lastVercelState: "READY",
  },
  {
    id: "nova-store",
    name: "Nova Storefront",
    domain: "store.nova-cloud.demo",
    allowedHosts: ["store.nova-cloud.demo"],
    checkUrl: "https://example.com",
    baseLatencyMs: 390,
    securityScore: 75,
    lastVercelState: "READY",
  },
  {
    id: "nova-docs",
    name: "Nova Docs",
    domain: "docs.nova-cloud.demo",
    allowedHosts: ["docs.nova-cloud.demo"],
    checkUrl: "https://example.com",
    baseLatencyMs: 112,
    securityScore: 100,
    lastVercelState: "READY",
  },
] as const;

function minutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

function buildInitialIncidents(): DemoIncident[] {
  return [
    {
      id: "inc_demo_waf_01",
      site_id: "nova-web",
      fingerprint: "cf-waf-spike:nova-web",
      category: "attack",
      severity: "high",
      source: "cloudflare-waf",
      status: "open",
      title: "Pico de escaneo automatizado mitigado por Cloudflare WAF",
      description:
        "Cloudflare bloqueó 31 peticiones automatizadas buscando /.env y /wp-login.php en los últimos 5 minutos.",
      occurrences: 31,
      started_at: minutesAgo(22),
      last_seen_at: minutesAgo(2),
      resolved_at: null,
      metadata: {
        topIps: ["203.0.113.42", "198.51.100.19"],
        topPaths: ["/.env", "/wp-login.php", "/.git/config"],
        actions: { block: 25, managed_challenge: 6 },
      },
    },
    {
      id: "inc_demo_block_02",
      site_id: "nova-api",
      fingerprint: "app-block:/v1/auth/login:198.51.100.77",
      category: "block",
      severity: "high",
      source: "app-sdk",
      status: "open",
      title: "Fuerza bruta detenida en /v1/auth/login",
      description:
        "El SDK de Vercel bloqueó 14 intentos fallidos de acceso en 1 minuto desde una sola IP.",
      occurrences: 14,
      started_at: minutesAgo(14),
      last_seen_at: minutesAgo(3),
      resolved_at: null,
      metadata: {
        clientIp: "198.51.100.77",
        path: "/v1/auth/login",
        method: "POST",
        httpStatus: 429,
      },
    },
    {
      id: "inc_demo_hdr_03",
      site_id: "nova-store",
      fingerprint: "sec-headers:nova-store",
      category: "security",
      severity: "low",
      source: "uptime-probe",
      status: "investigating",
      title: "Cabecera Content-Security-Policy ausente en Nova Storefront",
      description:
        "Falta content-security-policy en la respuesta HTTP principal (puntuación HDR 75/100).",
      occurrences: 1,
      started_at: minutesAgo(95),
      last_seen_at: minutesAgo(1),
      resolved_at: null,
      metadata: {
        missingHeaders: ["content-security-policy"],
        securityScore: 75,
      },
    },
    {
      id: "inc_demo_deploy_04",
      site_id: "nova-store",
      fingerprint: "vercel-deploy:nova-store",
      category: "deployment",
      severity: "medium",
      source: "vercel-api",
      status: "resolved",
      title: "Despliegue ERROR en Vercel (Nova Storefront)",
      description:
        'El despliegue dpl_demo_991 falló por error de compilación. — Nuevo despliegue dpl_demo_992 completado en estado READY.',
      occurrences: 1,
      started_at: minutesAgo(140),
      last_seen_at: minutesAgo(125),
      resolved_at: minutesAgo(125),
      metadata: {
        deploymentId: "dpl_demo_991",
        branch: "main",
        state: "READY",
      },
    },
  ];
}

function buildInitialSecurityEvents(): DemoSecurityEvent[] {
  return [
    {
      id: "ev_demo_01",
      site_id: "nova-web",
      occurred_at: minutesAgo(2),
      source: "cloudflare-waf",
      action: "block",
      rule_id: "waf-env-probe",
      rule_source: "firewallManaged",
      client_ip: "203.0.113.42",
      country: "DE",
      host: "nova-cloud.demo",
      path: "/.env",
      method: "GET",
      user_agent: "curl/8.4.0",
    },
    {
      id: "ev_demo_02",
      site_id: "nova-api",
      occurred_at: minutesAgo(3),
      source: "app-sdk",
      action: "rate_limit",
      rule_id: "app-auth-rl",
      rule_source: "app-middleware",
      client_ip: "198.51.100.77",
      country: "US",
      host: "api.nova-cloud.demo",
      path: "/v1/auth/login",
      method: "POST",
      user_agent: "python-requests/2.31",
    },
    {
      id: "ev_demo_03",
      site_id: "nova-web",
      occurred_at: minutesAgo(6),
      source: "cloudflare-waf",
      action: "block",
      rule_id: "waf-wp-scan",
      rule_source: "firewallManaged",
      client_ip: "198.51.100.19",
      country: "NL",
      host: "nova-cloud.demo",
      path: "/wp-login.php",
      method: "POST",
      user_agent: "Go-http-client/2.0",
    },
    {
      id: "ev_demo_04",
      site_id: "nova-store",
      occurred_at: minutesAgo(9),
      source: "cloudflare-waf",
      action: "managed_challenge",
      rule_id: "bot-fight-mode",
      rule_source: "bic",
      client_ip: "192.0.2.88",
      country: "SG",
      host: "store.nova-cloud.demo",
      path: "/checkout/coupon",
      method: "POST",
      user_agent: "Mozilla/5.0 (compatible; Scraper)",
    },
    {
      id: "ev_demo_05",
      site_id: "nova-api",
      occurred_at: minutesAgo(12),
      source: "cloudflare-waf",
      action: "block",
      rule_id: "ddos-l7-01",
      rule_source: "l7ddos",
      client_ip: "203.0.113.42",
      country: "DE",
      host: "api.nova-cloud.demo",
      path: "/v1/search",
      method: "GET",
      user_agent: "Scrapy/2.11",
    },
  ];
}

// Estado en memoria por isolate para que la demo sea interactiva
let demoIncidents: DemoIncident[] = buildInitialIncidents();
let demoSecurityEvents: DemoSecurityEvent[] = buildInitialSecurityEvents();
let demoNotes = new Map<
  string,
  Array<{ id: string; incident_id: string; author: string; content: string; created_at: string }>
>([
  [
    "inc_demo_waf_01",
    [
      {
        id: "note_demo_1",
        incident_id: "inc_demo_waf_01",
        author: "visitante-demo",
        content: "Regla WAF verificada; tráfico automatizado bloqueado en el borde sin impacto en origen.",
        created_at: minutesAgo(10),
      },
    ],
  ],
]);
let demoMutedSites = new Map<string, string | null>();

export function resetDemoState(): void {
  demoIncidents = buildInitialIncidents();
  demoSecurityEvents = buildInitialSecurityEvents();
  demoNotes = new Map();
  demoMutedSites = new Map();
}

export function getDemoNotes(incidentId: string) {
  return demoNotes.get(incidentId) ?? [];
}

export function addDemoNote(incidentId: string, content: string) {
  const note = {
    id: `note_${crypto.randomUUID().slice(0, 8)}`,
    incident_id: incidentId,
    author: "visitante-demo",
    content: content.slice(0, 800),
    created_at: new Date().toISOString(),
  };
  const existing = demoNotes.get(incidentId) ?? [];
  demoNotes.set(incidentId, [...existing, note]);
  return note;
}

export function setDemoSiteMute(siteId: string, minutes: number): string | null {
  const mutedUntil =
    minutes > 0 ? new Date(Date.now() + minutes * 60_000).toISOString() : null;
  demoMutedSites.set(siteId, mutedUntil);
  return mutedUntil;
}

export function getDemoIncidents(): DemoIncident[] {
  return demoIncidents;
}

export function getDemoSecurityEvents(): DemoSecurityEvent[] {
  return demoSecurityEvents;
}

export function updateDemoIncidentStatus(
  id: string,
  status: IncidentStatus
): DemoIncident | null {
  const target = demoIncidents.find((i) => i.id === id);
  if (!target) return null;
  target.status = status;
  target.resolved_at = status === "resolved" ? new Date().toISOString() : null;
  return target;
}

export function simulateDemoIncident(kind: "attack" | "downtime"): DemoIncident {
  const now = new Date().toISOString();
  const shortId = crypto.randomUUID().replace(/-/g, "").slice(0, 8);

  if (kind === "downtime") {
    const inc: DemoIncident = {
      id: `inc_sim_${shortId}`,
      site_id: "nova-api",
      fingerprint: `sim-down:${shortId}`,
      category: "downtime",
      severity: "critical",
      source: "uptime-probe",
      status: "open",
      title: "Simulación: Caída de origen Cloudflare (522) en Nova Core API",
      description:
        "Timeout de conexión entre Cloudflare Edge y el origen serverless (evento simulado para demostración).",
      occurrences: 2,
      started_at: now,
      last_seen_at: now,
      resolved_at: null,
      metadata: {
        statusCode: 522,
        latencyMs: 10000,
        simulated: true,
      },
    };
    demoIncidents = [inc, ...demoIncidents.slice(0, 25)];
    return inc;
  }

  const inc: DemoIncident = {
    id: `inc_sim_${shortId}`,
    site_id: "nova-web",
    fingerprint: `sim-ddos:${shortId}`,
    category: "attack",
    severity: "critical",
    source: "cloudflare-waf",
    status: "open",
    title: "Simulación: Mitigación DDoS L7 activa en Nova Cloud",
    description:
      "Cloudflare mitigó una ráfaga simulada de 48 peticiones maliciosas hacia /api/graphql.",
    occurrences: 48,
    started_at: now,
    last_seen_at: now,
    resolved_at: null,
    metadata: {
      topIps: ["203.0.113.99", "198.51.100.55"],
      topPaths: ["/api/graphql", "/login"],
      actions: { block: 42, rate_limit: 6 },
      simulated: true,
    },
  };
  demoIncidents = [inc, ...demoIncidents.slice(0, 25)];

  demoSecurityEvents = [
    {
      id: `ev_sim_${shortId}`,
      site_id: "nova-web",
      occurred_at: now,
      source: "cloudflare-waf",
      action: "block",
      rule_id: "ddos-l7-sim",
      rule_source: "l7ddos",
      client_ip: "203.0.113.99",
      country: "FR",
      host: "nova-cloud.demo",
      path: "/api/graphql",
      method: "POST",
      user_agent: "SimBot/1.0",
    },
    ...demoSecurityEvents.slice(0, 40),
  ];

  return inc;
}

export function buildDemoOverview() {
  const activeIncidents = demoIncidents.filter((i) => i.status !== "resolved");
  const criticalIncidents = activeIncidents.filter((i) => i.severity === "critical").length;

  const sites = DEMO_SITES.map((site, idx) => {
    const siteOpen = activeIncidents.filter((i) => i.site_id === site.id);
    const hasDown = siteOpen.some((i) => i.category === "downtime" && i.severity === "critical");
    const hasAttack = siteOpen.some(
      (i) => i.category === "attack" && (i.severity === "high" || i.severity === "critical")
    );
    const hasLatency = siteOpen.some((i) => i.category === "downtime" && i.severity === "medium");

    let status: SiteOperationalStatus = "up";
    if (hasDown) status = "down";
    else if (hasAttack) status = "under_attack";
    else if (hasLatency) status = "degraded";

    const recentBars = Array.from({ length: 24 }).map((_, i) => {
      const wave = Math.round(Math.sin((i + idx * 3) * 0.65) * 35);
      const isLastFail = hasDown && i >= 22;
      return {
        checkedAt: minutesAgo((24 - i) * 5),
        ok: !isLastFail,
        latencyMs: isLastFail ? 10000 : Math.max(70, site.baseLatencyMs + wave),
        statusCode: isLastFail ? 522 : 200,
      };
    });

    const secEventsCount = demoSecurityEvents.filter((e) => e.site_id === site.id).length;
    const rawMute = demoMutedSites.get(site.id) ?? null;
    const mutedUntil = rawMute && new Date(rawMute).getTime() > Date.now() ? rawMute : null;

    return {
      id: site.id,
      name: site.name,
      domain: site.domain,
      allowedHosts: site.allowedHosts,
      checkUrl: site.checkUrl,
      status,
      mutedUntil,
      slaBudgetRemainingPct: hasDown ? 93 : 100,
      uptime24h: hasDown ? 98.4 : 99.96,
      avgLatencyMs: site.baseLatencyMs,
      lastLatencyMs: recentBars[recentBars.length - 1].latencyMs,
      lastStatusCode: recentBars[recentBars.length - 1].statusCode,
      lastCheckedAt: minutesAgo(1),
      securityScore: site.securityScore,
      openIncidentsCount: siteOpen.length,
      securityEvents24h: secEventsCount,
      hasCloudflareZone: true,
      hasVercelProject: true,
      lastVercelState: site.lastVercelState,
      recentBars,
    };
  });

  const avgUptime = Number(
    (sites.reduce((a, s) => a + (s.uptime24h ?? 100), 0) / sites.length).toFixed(2)
  );
  const avgLat = Math.round(
    sites.reduce((a, s) => a + (s.avgLatencyMs ?? 150), 0) / sites.length
  );

  return {
    isDemo: true,
    auth: {
      mode: "demo" as const,
      user: "visitante-demo",
    },
    integrations: {
      cloudflareConfigured: true,
      vercelConfigured: true,
      telegramConfigured: true,
      discordConfigured: true,
      ingestSecretsConfigured: true,
      cfAccessVerifiedConfigured: true,
    },
    kpis: {
      totalSites: sites.length,
      globalUptime24h: avgUptime,
      globalAvgLatencyMs: avgLat,
      openIncidents: activeIncidents.length,
      criticalIncidents,
      securityEvents24h: demoSecurityEvents.length,
      mttrMinutes30d: 15,
    },
    sites,
  };
}

export function buildDemoUptimeSeries(siteId?: string, hours = 24) {
  const targetSites =
    siteId && siteId !== "all" ? DEMO_SITES.filter((s) => s.id === siteId) : DEMO_SITES;
  const pointsPerSite = Math.min(28, Math.max(10, Math.round(hours * 1.1)));
  const stepMin = Math.max(5, Math.round((hours * 60) / pointsPerSite));

  const checks: Array<{
    site_id: string;
    checked_at: string;
    ok: number;
    status_code: number;
    latency_ms: number;
  }> = [];

  for (let i = pointsPerSite; i >= 1; i--) {
    for (const site of targetSites) {
      const jitter = Math.round(Math.sin(i * 0.7 + site.baseLatencyMs) * 42);
      checks.push({
        site_id: site.id,
        checked_at: minutesAgo(i * stepMin),
        ok: 1,
        status_code: 200,
        latency_ms: Math.max(65, site.baseLatencyMs + jitter),
      });
    }
  }

  return checks;
}
