/**
 * ============================================================================
 * Rutas Privadas del Dashboard (`/api/dashboard/*`)
 * ============================================================================
 * Incluye:
 *  - Resumen general (`GET /overview`) con KPIs, MTTR y presupuesto SLA.
 *  - Gestión de incidencias, actualización en bloque (`POST /incidents/bulk-status`)
 *    y bitácora de notas post-mortem (`GET/POST /incidents/:id/notes`).
 *  - Modo Mantenimiento / Silenciado por sitio (`POST /sites/:siteId/mute`).
 *  - Diagnóstico profundo en vivo DNS/SSL/HTTP (`POST /sites/:siteId/inspect`).
 *  - Prueba inmediata de alertas Telegram/Discord (`POST /alerts/test`).
 */

import { Hono } from "hono";
import { syncCloudflareSecurity } from "../collectors/cloudflare.collector";
import { runUptimeChecks } from "../collectors/uptime.collector";
import { syncVercelDeployments } from "../collectors/vercel.collector";
import { SECURITY_LIMITS, VALID_STATUSES } from "../constants/security";
import { requireDashboardAuth } from "../middlewares/auth";
import { checkManualScanCooldown, checkRateLimit } from "../middlewares/rate-limit";
import {
  bulkUpdateIncidentStatus,
  listIncidentsFiltered,
  updateIncidentStatusById,
} from "../repositories/incidents.repo";
import { insertIncidentNote, listIncidentNotes } from "../repositories/notes.repo";
import { getSecurityBreakdown24h } from "../repositories/security-events.repo";
import { listUptimeSeries, setSiteMutedUntil } from "../repositories/uptime.repo";
import { getAllowedSite } from "../security/allowlist";
import { sendTestAlertNotification } from "../services/alerts.service";
import { buildDashboardOverview } from "../services/dashboard.service";
import { runSiteDeepDiagnostics } from "../services/diagnostics.service";
import type { AuthContext, Env, IncidentStatus } from "../types";
import { cleanText, sanitizeMetadata } from "../validators/ingest.validator";

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

dashboardRoutes.post("/incidents/bulk-status", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    ids?: unknown;
    status?: IncidentStatus;
  } | null;

  if (!body?.status || !VALID_STATUSES.has(body.status) || !Array.isArray(body.ids)) {
    return c.json({ error: "Proporciona un arreglo `ids` y un `status` válido." }, 400);
  }

  const validIds = body.ids
    .filter((id): id is string => typeof id === "string" && /^inc_[a-zA-Z0-9_-]{4,40}$/.test(id))
    .slice(0, 100);

  if (validIds.length === 0) {
    return c.json({ error: "No se recibieron IDs de incidencia válidos." }, 400);
  }

  const resolvedAt = body.status === "resolved" ? new Date().toISOString() : null;
  const updatedCount = await bulkUpdateIncidentStatus(c.env.DB, validIds, body.status, resolvedAt);
  return c.json({ ok: true, updatedCount });
});

dashboardRoutes.get("/incidents/:id/notes", async (c) => {
  const id = c.req.param("id").trim();
  if (!/^inc_[a-zA-Z0-9_-]{4,40}$/.test(id)) {
    return c.json({ error: "Identificador de incidencia inválido." }, 400);
  }

  const notes = await listIncidentNotes(c.env.DB, id);
  return c.json({ notes });
});

dashboardRoutes.post("/incidents/:id/notes", async (c) => {
  const id = c.req.param("id").trim();
  if (!/^inc_[a-zA-Z0-9_-]{4,40}$/.test(id)) {
    return c.json({ error: "Identificador de incidencia inválido." }, 400);
  }

  const body = (await c.req.json().catch(() => null)) as { content?: unknown } | null;
  const content = cleanText(body?.content, 800, true);
  if (!content) {
    return c.json({ error: "El contenido de la nota no puede estar vacío." }, 400);
  }

  const auth = c.get("auth");
  const note = await insertIncidentNote(c.env.DB, {
    id: `note_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
    incidentId: id,
    author: auth.user,
    content,
    createdAt: new Date().toISOString(),
  });

  return c.json({ ok: true, note }, 201);
});

dashboardRoutes.post("/sites/:siteId/mute", async (c) => {
  const siteId = c.req.param("siteId").trim();
  const site = getAllowedSite(c.env, siteId);
  if (!site) {
    return c.json({ error: "Sitio no permitido en lista blanca." }, 404);
  }

  const body = (await c.req.json().catch(() => null)) as { minutes?: number } | null;
  const minutes = Number(body?.minutes ?? 0);
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) {
    return c.json({ error: "Duración inválida (0 a 1440 minutos)." }, 400);
  }

  const mutedUntil =
    minutes > 0 ? new Date(Date.now() + minutes * 60_000).toISOString() : null;
  await setSiteMutedUntil(c.env.DB, site.id, mutedUntil);

  return c.json({ ok: true, siteId: site.id, mutedUntil });
});

dashboardRoutes.post("/sites/:siteId/inspect", async (c) => {
  const siteId = c.req.param("siteId").trim();
  const site = getAllowedSite(c.env, siteId);
  if (!site) {
    return c.json({ error: "Sitio no permitido en lista blanca." }, 404);
  }

  const rl = checkRateLimit(`inspect:${site.id}`, 10, 60_000);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.retryAfterSec));
    return c.json({ error: "Demasiados diagnósticos seguidos. Espera unos segundos." }, 429);
  }

  const diagnostics = await runSiteDeepDiagnostics(site);
  return c.json({ diagnostics });
});

dashboardRoutes.post("/alerts/test", async (c) => {
  const rl = checkRateLimit("alerts-test", 4, 60_000);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.retryAfterSec));
    return c.json({ error: "Espera un minuto antes de enviar otra alerta de prueba." }, 429);
  }

  const delivery = await sendTestAlertNotification(c.env);
  return c.json({ ok: true, delivery });
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
