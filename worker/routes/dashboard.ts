import { Hono } from "hono";
import { syncCloudflareSecurity } from "../collectors/cloudflare";
import { runUptimeChecks } from "../collectors/uptime";
import { syncVercelDeployments } from "../collectors/vercel";
import { getAllowedSite, getConfiguredSites } from "../lib/allowlist";
import { requireDashboardAuth, type AuthContext } from "../lib/auth";
import type {
  Env,
  IncidentRow,
  IncidentStatus,
  SecurityEventRow,
  SiteRuntimeStateRow,
  UptimeCheckRow,
} from "../types";

export const dashboardRoutes = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

dashboardRoutes.use("*", requireDashboardAuth);

dashboardRoutes.get("/overview", async (c) => {
  const sites = getConfiguredSites();
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [runtimeRes, uptimeRes, openIncRes, secCountRes] = await Promise.all([
    c.env.DB.prepare("SELECT * FROM site_runtime_state").all<SiteRuntimeStateRow>(),
    c.env.DB.prepare(
      `SELECT id, site_id, checked_at, ok, status_code, latency_ms, security_score, missing_headers
       FROM uptime_checks
       WHERE checked_at >= ?
       ORDER BY checked_at DESC
       LIMIT 1500`
    )
      .bind(since24h)
      .all<UptimeCheckRow>(),
    c.env.DB.prepare(
      `SELECT site_id, category, severity, status, COUNT(*) as count
       FROM incidents
       WHERE status IN ('open', 'investigating')
       GROUP BY site_id, category, severity, status`
    ).all<{ site_id: string; category: string; severity: string; status: string; count: number }>(),
    c.env.DB.prepare(
      `SELECT site_id, COUNT(*) as count
       FROM security_events
       WHERE occurred_at >= ?
       GROUP BY site_id`
    )
      .bind(since24h)
      .all<{ site_id: string; count: number }>(),
  ]);

  const runtimeMap = new Map(runtimeRes.results.map((r) => [r.site_id, r]));
  const secMap = new Map(secCountRes.results.map((r) => [r.site_id, r.count]));

  const checksBySite = new Map<string, UptimeCheckRow[]>();
  for (const row of uptimeRes.results) {
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
    const uptime24h = checks.length > 0 ? Number(((okCount / checks.length) * 100).toFixed(2)) : null;

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

    const siteOpenRows = openIncRes.results.filter((r) => r.site_id === site.id);
    const openIncidentsCount = siteOpenRows.reduce((acc, r) => acc + r.count, 0);
    const hasCritical = siteOpenRows.some((r) => r.severity === "critical");
    const hasActiveAttack = siteOpenRows.some(
      (r) => r.category === "attack" && (r.severity === "high" || r.severity === "critical")
    );

    totalOpenIncidents += openIncidentsCount;
    if (hasCritical) {
      criticalIncidents += siteOpenRows
        .filter((r) => r.severity === "critical")
        .reduce((acc, r) => acc + r.count, 0);
    }

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

  return c.json({
    auth: c.get("auth"),
    integrations: {
      cloudflareConfigured: Boolean(c.env.CLOUDFLARE_API_TOKEN),
      vercelConfigured: Boolean(c.env.VERCEL_API_TOKEN),
      telegramConfigured: Boolean(c.env.TELEGRAM_BOT_TOKEN && c.env.TELEGRAM_CHAT_ID),
      discordConfigured: Boolean(c.env.DISCORD_WEBHOOK_URL),
      ingestSecretsConfigured: Boolean(c.env.SITE_SECRETS_JSON),
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
  });
});

dashboardRoutes.get("/incidents", async (c) => {
  const siteId = c.req.query("siteId")?.trim();
  const category = c.req.query("category")?.trim();
  const severity = c.req.query("severity")?.trim();
  const status = c.req.query("status")?.trim();
  const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? "100") || 100));

  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (siteId && siteId !== "all") {
    if (!getAllowedSite(siteId)) {
      return c.json({ error: "Sitio no permitido en allowlist." }, 400);
    }
    conditions.push("site_id = ?");
    bindings.push(siteId);
  }
  if (category && category !== "all") {
    conditions.push("category = ?");
    bindings.push(category);
  }
  if (severity && severity !== "all") {
    conditions.push("severity = ?");
    bindings.push(severity);
  }
  if (status && status !== "all") {
    if (status === "active") {
      conditions.push("status IN ('open', 'investigating')");
    } else {
      conditions.push("status = ?");
      bindings.push(status);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `SELECT * FROM incidents ${where} ORDER BY CASE status WHEN 'open' THEN 1 WHEN 'investigating' THEN 2 ELSE 3 END, last_seen_at DESC LIMIT ?`;

  const result = await c.env.DB.prepare(query)
    .bind(...bindings, limit)
    .all<IncidentRow>();

  const incidents = result.results.map((row) => {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(row.metadata_json || "{}") as Record<string, unknown>;
    } catch {
      metadata = {};
    }
    return {
      ...row,
      metadata,
    };
  });

  return c.json({ incidents });
});

dashboardRoutes.patch("/incidents/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => null)) as { status?: IncidentStatus } | null;

  if (!body?.status || !["open", "investigating", "resolved"].includes(body.status)) {
    return c.json({ error: "Estado inválido. Usa open, investigating o resolved." }, 400);
  }

  const now = new Date().toISOString();
  const resolvedAt = body.status === "resolved" ? now : null;

  const res = await c.env.DB.prepare(
    `UPDATE incidents SET status = ?, resolved_at = ? WHERE id = ?`
  )
    .bind(body.status, resolvedAt, id)
    .run();

  if ((res.meta?.changes ?? 0) === 0) {
    return c.json({ error: "Incidencia no encontrada." }, 404);
  }

  return c.json({ ok: true, id, status: body.status, resolved_at: resolvedAt });
});

dashboardRoutes.get("/security", async (c) => {
  const siteId = c.req.query("siteId")?.trim();
  const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? "60") || 60));
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();

  const whereParts: string[] = [];
  const bindings: unknown[] = [];

  if (siteId && siteId !== "all") {
    if (!getAllowedSite(siteId)) {
      return c.json({ error: "Sitio no permitido en allowlist." }, 400);
    }
    whereParts.push("site_id = ?");
    bindings.push(siteId);
  }

  const whereEvents = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
  const where24h = `WHERE occurred_at >= ?${whereParts.length ? ` AND ${whereParts.join(" AND ")}` : ""}`;

  const [eventsRes, topIpsRes, actionsRes, topPathsRes] = await Promise.all([
    c.env.DB.prepare(
      `SELECT * FROM security_events ${whereEvents} ORDER BY occurred_at DESC LIMIT ?`
    )
      .bind(...bindings, limit)
      .all<SecurityEventRow>(),
    c.env.DB.prepare(
      `SELECT client_ip as ip, country, COUNT(*) as count
       FROM security_events
       ${where24h} AND client_ip IS NOT NULL
       GROUP BY client_ip, country
       ORDER BY count DESC
       LIMIT 8`
    )
      .bind(since24h, ...bindings)
      .all<{ ip: string; country: string | null; count: number }>(),
    c.env.DB.prepare(
      `SELECT action, COUNT(*) as count
       FROM security_events
       ${where24h}
       GROUP BY action
       ORDER BY count DESC`
    )
      .bind(since24h, ...bindings)
      .all<{ action: string; count: number }>(),
    c.env.DB.prepare(
      `SELECT path, COUNT(*) as count
       FROM security_events
       ${where24h} AND path IS NOT NULL
       GROUP BY path
       ORDER BY count DESC
       LIMIT 8`
    )
      .bind(since24h, ...bindings)
      .all<{ path: string; count: number }>(),
  ]);

  return c.json({
    events: eventsRes.results,
    topIps: topIpsRes.results,
    actionsBreakdown: actionsRes.results,
    topPaths: topPathsRes.results,
  });
});

dashboardRoutes.get("/uptime", async (c) => {
  const siteId = c.req.query("siteId")?.trim();
  const hours = Math.min(168, Math.max(1, Number(c.req.query("hours") ?? "24") || 24));
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  const whereParts = ["checked_at >= ?"];
  const bindings: unknown[] = [since];

  if (siteId && siteId !== "all") {
    if (!getAllowedSite(siteId)) {
      return c.json({ error: "Sitio no permitido en allowlist." }, 400);
    }
    whereParts.push("site_id = ?");
    bindings.push(siteId);
  }

  const res = await c.env.DB.prepare(
    `SELECT site_id, checked_at, ok, status_code, latency_ms
     FROM uptime_checks
     WHERE ${whereParts.join(" AND ")}
     ORDER BY checked_at ASC
     LIMIT 600`
  )
    .bind(...bindings)
    .all<Pick<UptimeCheckRow, "site_id" | "checked_at" | "ok" | "status_code" | "latency_ms">>();

  return c.json({ checks: res.results });
});

dashboardRoutes.post("/checks/run", async (c) => {
  const [uptime, cloudflare, vercel] = await Promise.all([
    runUptimeChecks(c.env),
    syncCloudflareSecurity(c.env),
    syncVercelDeployments(c.env),
  ]);

  return c.json({
    ok: true,
    ranAt: new Date().toISOString(),
    uptime,
    cloudflare,
    vercel,
  });
});
