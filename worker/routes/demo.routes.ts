/**
 * ============================================================================
 * Rutas del Modo Demo Público (`/api/dashboard/*` cuando `DEMO_MODE=true`)
 * ============================================================================
 * Sirve exclusivamente datos ficticios y expone un analizador de prueba
 * protegido con anti-SSRF y rate-limit estricto (5 análisis/min/IP).
 */

import { Hono } from "hono";
import { VALID_STATUSES } from "../constants/security";
import {
  buildDemoOverview,
  buildDemoUptimeSeries,
  DEMO_SITES,
  getDemoIncidents,
  getDemoSecurityEvents,
  resetDemoState,
  simulateDemoIncident,
  updateDemoIncidentStatus,
} from "../demo/demo.data";
import { runLiveDemoProbe } from "../demo/demo-probe.service";
import { checkRateLimit } from "../middlewares/rate-limit";
import type { Env, IncidentStatus } from "../types";

export const demoRoutes = new Hono<{ Bindings: Env }>();

demoRoutes.get("/overview", (c) => {
  return c.json(buildDemoOverview());
});

demoRoutes.get("/incidents", (c) => {
  const siteId = c.req.query("siteId")?.trim();
  const category = c.req.query("category")?.trim();
  const severity = c.req.query("severity")?.trim();
  const status = c.req.query("status")?.trim();

  const filtered = getDemoIncidents().filter((inc) => {
    if (siteId && siteId !== "all" && inc.site_id !== siteId) return false;
    if (category && category !== "all" && inc.category !== category) return false;
    if (severity && severity !== "all" && inc.severity !== severity) return false;
    if (status && status !== "all") {
      if (status === "active" && inc.status === "resolved") return false;
      if (status !== "active" && inc.status !== status) return false;
    }
    return true;
  });

  return c.json({ incidents: filtered });
});

demoRoutes.patch("/incidents/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => null)) as { status?: IncidentStatus } | null;

  if (!body?.status || !VALID_STATUSES.has(body.status)) {
    return c.json({ error: "Estado inválido." }, 400);
  }

  const updated = updateDemoIncidentStatus(id, body.status);
  if (!updated) {
    return c.json({ error: "Incidencia de demostración no encontrada." }, 404);
  }

  return c.json({ ok: true, id, status: updated.status, resolved_at: updated.resolved_at });
});

demoRoutes.get("/security", (c) => {
  const siteId = c.req.query("siteId")?.trim();
  const events =
    siteId && siteId !== "all"
      ? getDemoSecurityEvents().filter((e) => e.site_id === siteId)
      : getDemoSecurityEvents();

  const ipCounts = new Map<string, { ip: string; country: string | null; count: number }>();
  const actionCounts = new Map<string, number>();
  const pathCounts = new Map<string, number>();

  for (const ev of events) {
    if (ev.client_ip) {
      const prev = ipCounts.get(ev.client_ip);
      ipCounts.set(ev.client_ip, {
        ip: ev.client_ip,
        country: ev.country,
        count: (prev?.count ?? 0) + 1,
      });
    }
    actionCounts.set(ev.action, (actionCounts.get(ev.action) ?? 0) + 1);
    if (ev.path) {
      pathCounts.set(ev.path, (pathCounts.get(ev.path) ?? 0) + 1);
    }
  }

  return c.json({
    events,
    topIps: Array.from(ipCounts.values()).sort((a, b) => b.count - a.count),
    actionsBreakdown: Array.from(actionCounts.entries())
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count),
    topPaths: Array.from(pathCounts.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count),
  });
});

demoRoutes.get("/uptime", (c) => {
  const siteId = c.req.query("siteId")?.trim();
  const hours = Math.min(168, Math.max(1, Number(c.req.query("hours") ?? "24") || 24));
  return c.json({ checks: buildDemoUptimeSeries(siteId, hours) });
});

demoRoutes.post("/checks/run", (c) => {
  return c.json({
    ok: true,
    ranAt: new Date().toISOString(),
    uptime: DEMO_SITES.map((s) => ({
      siteId: s.id,
      ok: true,
      statusCode: 200,
      latencyMs: s.baseLatencyMs,
    })),
  });
});

/** Analiza una URL pública de prueba en vivo (anti-SSRF + máx. 5/min/IP) */
demoRoutes.post("/demo/probe", async (c) => {
  const clientIp = c.req.header("cf-connecting-ip") ?? "demo-local";
  const rl = checkRateLimit(`demo-probe:${clientIp}`, 5, 60_000);
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.retryAfterSec));
    return c.json(
      { error: `Límite de 5 pruebas por minuto alcanzado. Reintenta en ${rl.retryAfterSec}s.` },
      429
    );
  }

  const body = (await c.req.json().catch(() => null)) as { url?: string } | null;
  if (!body?.url || typeof body.url !== "string") {
    return c.json({ error: "Proporciona una URL pública en el campo `url`." }, 400);
  }

  const result = await runLiveDemoProbe(body.url);
  return c.json({ result });
});

/** Simula un ataque WAF o caída 522 para mostrar la reacción en vivo de UMBRAL */
demoRoutes.post("/demo/simulate", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { kind?: "attack" | "downtime" } | null;
  const kind = body?.kind === "downtime" ? "downtime" : "attack";
  const incident = simulateDemoIncident(kind);
  return c.json({ ok: true, incident });
});

/** Restablece el estado de demostración al estado inicial */
demoRoutes.post("/demo/reset", (c) => {
  resetDemoState();
  return c.json({ ok: true });
});
