/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  worker/middlewares/security-headers.ts
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
 * Middleware de Cabeceras Defensivas HTTP
 * ============================================================================
 * Aplica CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy
 * y Cache-Control estricto a todas las respuestas servidas por el Worker.
 */

import type { Context, Next } from "hono";
import { DASHBOARD_CSP } from "../constants/security";

export async function securityHeadersMiddleware(c: Context, next: Next) {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  c.header("Content-Security-Policy", DASHBOARD_CSP);

  if (c.req.path.startsWith("/api/")) {
    c.header("Cache-Control", "no-store, max-age=0");
  }
}
