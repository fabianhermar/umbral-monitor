/**
 * ============================================================================
 * Servicio de Dominio — Agregación de Métricas y Resumen del Dashboard
 * ============================================================================
 * Calcula los KPIs globales (Uptime 24h, latencia media, incidencias activas,
 * eventos de seguridad) y arma el estado detallado de cada dominio permitido.
 */

import { countActiveIncidentsGrouped } from "../repositories/incidents.repo";
import { countSecurityEventsSinceBySite } from "../repositories/security-events.repo";
import {
  getAllSiteRuntimeStates,
  listRecentUptimeChecksSince,
} from "../repositories/uptime.repo";
import { getConfiguredSites } from "../security/allowlist";
import type { AuthContext, Env, UptimeCheckRow } from "../types";

export async function buildDashboardOverview(env: Env, auth: AuthContext) {
  const sites = getConfiguredSites(env);
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [runtimeRows, uptimeRows, openIncidentGroups, securityCounts] = await Promise.all([
    getAllSiteRuntimeStates(env.DB),
    listRecentUptimeChecksSince(env.DB, since24h, 1500),
    countActiveIncidentsGrouped(env.DB),
    countSecurityEventsSinceBySite(env.DB, since24h),
  ]);

  const runtimeMap = new Map(runtimeRows.map((r) => [r.site_id, r]));
  const secMap = new Map(securityCounts.map((r) => [r.site_id, r.count]));

  const checksBySite = new Map<string, UptimeCheckRow[]>();
  for (const row of uptimeRows) {
    const list = checksBySite.get(row.site_id) ?? [];
    list.push(row);
    checksBySite.set(row.site_id, list);
  }

  let totalChecks = 0;
  let totalOkChecks = 0;
  let totalLatencySum = 0;
  let totalLatencyCount = 0;
  let totalOpenIncidents = 0;
  let criticalIncidents = 0;
  let totalSecurityEvents24h = 0;

  const siteSummaries = sites.map((site) => {
    const checks = checksBySite.get(site.id) ?? [];
    const runtime = runtimeMap.get(site.id);
    const okCount = checks.filter((ch) => ch.ok === 1).length;
    const uptime24h =
      checks.length > 0 ? Number(((okCount / checks.length) * 100).toFixed(2)) : null;

    const validLatencies = checks.filter((ch) => ch.ok === 1).map((ch) => ch.latency_ms);
    const avgLatencyMs =
      validLatencies.length > 0
        ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
        : null;

    totalChecks += checks.length;
    totalOkChecks += okCount;
    for (const ms of validLatencies) {
      totalLatencySum += ms;
      totalLatencyCount += 1;
    }

    const siteOpenRows = openIncidentGroups.filter((r) => r.site_id === site.id);
    const openIncidentsCount = siteOpenRows.reduce((acc, r) => acc + r.count, 0);
    const siteCriticals = siteOpenRows
      .filter((r) => r.severity === "critical")
      .reduce((acc, r) => acc + r.count, 0);
    const hasActiveAttack = siteOpenRows.some(
      (r) => r.category === "attack" && (r.severity === "high" || r.severity === "critical")
    );

    totalOpenIncidents += openIncidentsCount;
    criticalIncidents += siteCriticals;

    const securityEvents24h = secMap.get(site.id) ?? 0;
    totalSecurityEvents24h += securityEvents24h;

    const latestCheck = checks[0] ?? null;
    let status = runtime?.last_status ?? "unknown";
    if (status === "up" && hasActiveAttack) {
      status = "under_attack";
    }

    return {
      id: site.id,
      name: site.name,
      domain: site.domain,
      allowedHosts: site.allowedHosts,
      checkUrl: site.checkUrl,
      status,
      uptime24h,
      avgLatencyMs,
      lastLatencyMs: latestCheck?.latency_ms ?? null,
      lastStatusCode: latestCheck?.status_code ?? null,
      lastCheckedAt: runtime?.last_checked_at ?? latestCheck?.checked_at ?? null,
      securityScore: latestCheck?.security_score ?? 100,
      openIncidentsCount,
      securityEvents24h,
      hasCloudflareZone: Boolean(site.cloudflareZoneId?.trim()),
      hasVercelProject: Boolean(site.vercelProjectId?.trim()),
      lastVercelState: runtime?.last_vercel_deployment_state ?? null,
      recentBars: checks
        .slice(0, 24)
        .reverse()
        .map((ch) => ({
          checkedAt: ch.checked_at,
          ok: ch.ok === 1,
          latencyMs: ch.latency_ms,
          statusCode: ch.status_code,
        })),
    };
  });

  const globalUptime24h =
    totalChecks > 0 ? Number(((totalOkChecks / totalChecks) * 100).toFixed(2)) : null;
  const globalAvgLatencyMs =
    totalLatencyCount > 0 ? Math.round(totalLatencySum / totalLatencyCount) : null;

  return {
    auth,
    integrations: {
      cloudflareConfigured: Boolean(env.CLOUDFLARE_API_TOKEN),
      vercelConfigured: Boolean(env.VERCEL_API_TOKEN),
      telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
      discordConfigured: Boolean(env.DISCORD_WEBHOOK_URL),
      ingestSecretsConfigured: Boolean(env.SITE_SECRETS_JSON),
      cfAccessVerifiedConfigured: Boolean(env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD),
    },
    kpis: {
      totalSites: sites.length,
      globalUptime24h,
      globalAvgLatencyMs,
      openIncidents: totalOpenIncidents,
      criticalIncidents,
      securityEvents24h: totalSecurityEvents24h,
    },
    sites: siteSummaries,
  };
}
