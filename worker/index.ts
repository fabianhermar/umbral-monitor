/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  worker/index.ts
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
 * Punto de Entrada del Cloudflare Worker (`UMBRAL`)
 * ============================================================================
 * Soporta dos modos completamente aislados:
 *  - Producción privada (`DEMO_MODE` desactivado): D1 real, lista blanca real,
 *    crons automáticos cada 1 y 5 min y autenticación estricta.
 *  - Demo pública (`DEMO_MODE=true` vía `wrangler.demo.jsonc`): datos ficticios,
 *    cero secretos reales, sin conexión a D1 y analizador anti-SSRF en vivo.
 */

import { Hono } from "hono";
import { syncCloudflareSecurity } from "./collectors/cloudflare.collector";
import { runUptimeChecks } from "./collectors/uptime.collector";
import { syncVercelDeployments } from "./collectors/vercel.collector";
import { securityHeadersMiddleware } from "./middlewares/security-headers";
import { dashboardRoutes } from "./routes/dashboard.routes";
import { demoRoutes } from "./routes/demo.routes";
import { healthRoutes } from "./routes/health.routes";
import { ingestRoutes } from "./routes/ingest.routes";
import { pruneOldRecords } from "./services/incidents.service";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use("*", securityHeadersMiddleware);

app.route("/api/health", healthRoutes);

app.all("/api/ingest/*", async (c) => {
  if (c.env.DEMO_MODE === "true") {
    return c.json({ error: "Ingesta desactivada en Modo Demo público." }, 403);
  }
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace(/^\/api\/ingest/, "") || "/";
  return ingestRoutes.fetch(new Request(url.toString(), c.req.raw), c.env, c.executionCtx);
});

app.all("/api/ingest", async (c) => {
  if (c.env.DEMO_MODE === "true") {
    return c.json({ error: "Ingesta desactivada en Modo Demo público." }, 403);
  }
  const url = new URL(c.req.url);
  url.pathname = "/";
  return ingestRoutes.fetch(new Request(url.toString(), c.req.raw), c.env, c.executionCtx);
});

app.all("/api/dashboard/*", async (c) => {
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace(/^\/api\/dashboard/, "") || "/";
  const req = new Request(url.toString(), c.req.raw);

  if (c.env.DEMO_MODE === "true") {
    return demoRoutes.fetch(req, c.env, c.executionCtx);
  }
  return dashboardRoutes.fetch(req, c.env, c.executionCtx);
});

app.all("/api/*", (c) => c.json({ error: "Endpoint no encontrado." }, 404));

app.onError((err, c) => {
  console.error("[UMBRAL Worker Error]:", err instanceof Error ? err.message : "Unknown error");
  return c.json({ error: "Error interno procesando la solicitud." }, 500);
});

app.all("*", async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text("Interfaz no compilada. Ejecuta `pnpm build`.", 404);
});

export default {
  fetch: app.fetch,

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (env.DEMO_MODE === "true") return;

    if (controller.cron === "*/5 * * * *") {
      ctx.waitUntil(
        Promise.allSettled([
          syncCloudflareSecurity(env),
          syncVercelDeployments(env),
          pruneOldRecords(env),
        ])
      );
      return;
    }

    ctx.waitUntil(runUptimeChecks(env));
  },
};
