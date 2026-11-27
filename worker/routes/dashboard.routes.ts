/**
 * ============================================================================
 * Rutas Privadas del Dashboard (`/api/dashboard/*`)
 * ============================================================================
 * Controladores HTTP delgados: validan parámetros de entrada, delegan toda la
 * lógica a servicios/repositorios y devuelven respuestas JSON limpias.
 */

import { Hono } from "hono";
import { syncCloudflareSecurity } from "../collectors/cloudflare.collector";
import { runUptimeChecks } from "../collectors/uptime.collector";
import { syncVercelDeployments } from "../collectors/vercel.collector";
import { SECURITY_LIMITS, VALID_STATUSES } from "../constants/security";
import { requireDashboardAuth } from "../middlewares/auth";
import { checkManualScanCooldown } from "../middlewares/rate-limit";
import {
  listIncidentsFiltered,
  updateIncidentStatusById,
} from "../repositories/incidents.repo";
import { getSecurityBreakdown24h } from "../repositories/security-events.repo";
import { listUptimeSeries } from "../repositories/uptime.repo";
import { getAllowedSite } from "../security/allowlist";
import { buildDashboardOverview } from "../services/dashboard.service";
import type { AuthContext, Env, IncidentStatus } from "../types";
import { sanitizeMetadata } from "../validators/ingest.validator";

export const dashboardRoutes = new Hono<{
  Bindings: Env;
  Variables: { auth: AuthContext };
}>();

dashboardRoutes.use("*", requireDashboardAuth);

dashboardRoutes.get("/overview", async (c) => {
  const overview = await buildDashboardOverview(c.env, c.get("auth"));
  return c.json(overview);
});

dashboardRoutes.get("/incidents", async (c) => {
  const siteIdParam = c.req.query("siteId")?.trim();
  const category = c.req.query("category")?.trim();
  const severity = c.req.query("severity")?.trim();
  const status = c.req.query("status")?.trim();
  const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? "100") || 100));

  let validSiteId: string | undefined;
  if (siteIdParam && siteIdParam !== "all") {
    if (!getAllowedSite(c.env, siteIdParam)) {
      return c.json({ error: "Sitio no permitido en lista blanca." }, 400);
    }
    validSiteId = siteIdParam;
  }

  const rows = await listIncidentsFiltered(c.env.DB, {
    siteId: validSiteId,
    category,
    severity,
    status,
    limit,
  });

  const incidents = rows.map((row) => {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = sanitizeMetadata(JSON.parse(row.metadata_json || "{}"));
    } catch {
      metadata = {};
    }
    return { ...row, metadata };
  });

  return c.json({ incidents });
});

dashboardRoutes.patch("/incidents/:id", async (c) => {
  const id = c.req.param("id").trim();
  if (!/^inc_[a-zA-Z0-9_-]{4,40}$/.test(id)) {
    return c.json({ error: "Identificador de incidencia inválido." }, 400);
  }

  const body = (await c.req.json().catch(() => null)) as { status?: IncidentStatus } | null;
  if (!body?.status || !VALID_STATUSES.has(body.status)) {
    return c.json({ error: "Estado inválido. Usa open, investigating o resolved." }, 400);
  }

  const now = new Date().toISOString();
  const resolvedAt = body.status === "resolved" ? now : null;
  const updated = await updateIncidentStatusById(c.env.DB, id, body.status, resolvedAt);

  if (!updated) {
    return c.json({ error: "Incidencia no encontrada." }, 404);
  }

  return c.json({ ok: true, id, status: body.status, resolved_at: resolvedAt });
});

dashboardRoutes.get("/security", async (c) => {
  const siteIdParam = c.req.query("siteId")?.trim();
  const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? "60") || 60));
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();

  let validSiteId: string | undefined;
  if (siteIdParam && siteIdParam !== "all") {
    if (!getAllowedSite(c.env, siteIdParam)) {
      return c.json({ error: "Sitio no permitido en lista blanca." }, 400);
    }
    validSiteId = siteIdParam;
  }

  const breakdown = await getSecurityBreakdown24h(c.env.DB, since24h, validSiteId, limit);
  return c.json(breakdown);
});

dashboardRoutes.get("/uptime", async (c) => {
  const siteIdParam = c.req.query("siteId")?.trim();
  const hours = Math.min(168, Math.max(1, Number(c.req.query("hours") ?? "24") || 24));
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  let validSiteId: string | undefined;
  if (siteIdParam && siteIdParam !== "all") {
    if (!getAllowedSite(c.env, siteIdParam)) {
      return c.json({ error: "Sitio no permitido en lista blanca." }, 400);
    }
    validSiteId = siteIdParam;
  }

  const checks = await listUptimeSeries(c.env.DB, since, validSiteId, 600);
  return c.json({ checks });
});

dashboardRoutes.post("/checks/run", async (c) => {
  const cooldown = checkManualScanCooldown(SECURITY_LIMITS.MANUAL_CHECK_COOLDOWN_MS);
  if (!cooldown.allowed) {
    c.header("Retry-After", String(cooldown.retryAfterSec));
    return c.json(
      { error: `Espera ${cooldown.retryAfterSec}s antes de lanzar otro escaneo manual.` },
      429
    );
  }

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
