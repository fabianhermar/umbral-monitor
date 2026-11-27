/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  worker/middlewares/auth.ts
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
 * Middleware de Autenticación del Dashboard Privado
 * ============================================================================
 * Orden de verificación seguro:
 *  1. Cloudflare Access JWT verificado criptográficamente (RS256 + JWKS + AUD)
 *     cuando `CF_ACCESS_TEAM_DOMAIN` y `CF_ACCESS_AUD` están configurados.
 *  2. Clave privada `DASHBOARD_API_KEY` comparada en tiempo constante real
 *     sin fuga de longitud, protegida contra fuerza bruta por IP.
 *  3. Modo desarrollo local (`ENVIRONMENT=development`) exclusivamente en local.
 */

import type { Context, Next } from "hono";
import { SECURITY_LIMITS } from "../constants/security";
import { verifyCloudflareAccessJwt } from "../security/cf-access-jwt";
import { timingSafeEqualStrings } from "../security/crypto";
import type { AuthContext, Env } from "../types";
import { checkRateLimit } from "./rate-limit";

export async function requireDashboardAuth(
  c: Context<{ Bindings: Env; Variables: { auth: AuthContext } }>,
  next: Next
) {
  const env = c.env;
  const clientIp = c.req.header("cf-connecting-ip") ?? "local";

  // 1. Cloudflare Access con verificación criptográfica real de JWT
  const cfJwt = c.req.header("Cf-Access-Jwt-Assertion")?.trim();
  if (cfJwt && env.CF_ACCESS_TEAM_DOMAIN && env.CF_ACCESS_AUD) {
    const verification = await verifyCloudflareAccessJwt(
      cfJwt,
      env.CF_ACCESS_TEAM_DOMAIN,
      env.CF_ACCESS_AUD
    );

    if (verification.valid && verification.email) {
      const expectedAdmin = env.DASHBOARD_ADMIN_EMAIL?.trim().toLowerCase();
      if (expectedAdmin && verification.email !== expectedAdmin) {
        return c.json(
          { error: "Acceso denegado: correo no autorizado para este observatorio privado." },
          403
        );
      }
      c.set("auth", { mode: "cloudflare-access", user: verification.email });
      return next();
    }
  }

  // 2. Clave privada Bearer o X-Dashboard-Key (comparación en tiempo constante)
  const configuredApiKey = env.DASHBOARD_API_KEY?.trim();
  if (configuredApiKey) {
    const authHeader = c.req.header("Authorization") ?? "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const keyHeader = c.req.header("X-Dashboard-Key")?.trim() ?? "";
    const provided = bearer || keyHeader;

    if (provided) {
      const isValid = await timingSafeEqualStrings(provided, configuredApiKey);
      if (isValid) {
        c.set("auth", { mode: "api-key", user: env.DASHBOARD_ADMIN_EMAIL ?? "admin" });
        return next();
      }

      // Contabilizar intento fallido contra fuerza bruta por IP
      const rl = checkRateLimit(
        `auth-fail:${clientIp}`,
        SECURITY_LIMITS.AUTH_MAX_FAILURES_PER_MIN,
        60_000
      );
      if (!rl.allowed) {
        c.header("Retry-After", String(rl.retryAfterSec));
        return c.json(
          { error: "Demasiados intentos fallidos. Espera un minuto antes de reintentar." },
          429
        );
      }
    }
  }

  // 3. Modo desarrollo local (`ENVIRONMENT=development` únicamente en .dev.vars)
  if (env.ENVIRONMENT === "development") {
    c.set("auth", { mode: "development", user: "local-dev" });
    return next();
  }

  return c.json(
    {
      error:
        "No autorizado. Inicia sesión con tu DASHBOARD_API_KEY o configura Cloudflare Access.",
    },
    401
  );
}
