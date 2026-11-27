import type { Context, Next } from "hono";
import type { Env } from "../types";
import { timingSafeEqual } from "./crypto";

export interface AuthContext {
  mode: "cloudflare-access" | "api-key" | "development";
  user: string;
}

export async function securityHeadersMiddleware(c: Context, next: Next) {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  if (c.req.path.startsWith("/api/")) {
    c.header("Cache-Control", "no-store");
  }
}

export async function requireDashboardAuth(
  c: Context<{ Bindings: Env; Variables: { auth: AuthContext } }>,
  next: Next
) {
  const env = c.env;

  // 1. Validación por Cloudflare Access (Zero Trust) — recomendado en producción
  const cfEmail = c.req.header("Cf-Access-Authenticated-User-Email")?.trim().toLowerCase();
  const cfJwt = c.req.header("Cf-Access-Jwt-Assertion");

  if (cfEmail && cfJwt) {
    const expectedAdmin = env.DASHBOARD_ADMIN_EMAIL?.trim().toLowerCase();
    if (expectedAdmin && cfEmail !== expectedAdmin) {
      return c.json(
        { error: "Acceso denegado: correo no autorizado para este dashboard privado." },
        403
      );
    }
    c.set("auth", { mode: "cloudflare-access", user: cfEmail });
    return next();
  }

  // 2. Validación alternativa por clave Bearer / header X-Dashboard-Key
  const configuredApiKey = env.DASHBOARD_API_KEY?.trim();
  if (configuredApiKey) {
    const authHeader = c.req.header("Authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const keyHeader = c.req.header("X-Dashboard-Key")?.trim() ?? "";
    const provided = bearer || keyHeader;

    if (provided && timingSafeEqual(provided, configuredApiKey)) {
      c.set("auth", { mode: "api-key", user: env.DASHBOARD_ADMIN_EMAIL ?? "admin" });
      return next();
    }
  }

  // 3. Modo desarrollo local (`ENVIRONMENT=development` en .dev.vars)
  if (env.ENVIRONMENT === "development") {
    c.set("auth", { mode: "development", user: "local-dev" });
    return next();
  }

  return c.json(
    {
      error:
        "No autorizado. Protege este dashboard con Cloudflare Access o proporciona X-Dashboard-Key.",
    },
    401
  );
}
