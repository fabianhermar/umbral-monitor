import { Hono } from "hono";
import { syncCloudflareSecurity } from "./collectors/cloudflare";
import { runUptimeChecks } from "./collectors/uptime";
import { syncVercelDeployments } from "./collectors/vercel";
import { securityHeadersMiddleware } from "./lib/auth";
import { pruneOldRecords } from "./lib/db";
import { dashboardRoutes } from "./routes/dashboard";
import { ingestRoutes } from "./routes/ingest";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use("*", securityHeadersMiddleware);

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "umbral-perimeter-os",
    timestamp: new Date().toISOString(),
  })
);

app.route("/api/ingest", ingestRoutes);
app.route("/api/dashboard", dashboardRoutes);

app.all("/api/*", (c) => c.json({ error: "Endpoint no encontrado." }, 404));

app.all("*", async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text("Dashboard UI no compilada. Ejecuta `pnpm build`.", 404);
});

export default {
  fetch: app.fetch,

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
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

    // Cron de cada minuto (* * * * *)
    ctx.waitUntil(runUptimeChecks(env));
  },
};
