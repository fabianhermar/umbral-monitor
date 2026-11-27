/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  worker/routes/health.routes.ts
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
 * Ruta Pública de Salud del Propio Servicio (`/api/health`)
 * ============================================================================
 * Responde únicamente con estado operativo básico sin exponer métricas ni
 * información sensible.
 */

import { Hono } from "hono";
import type { Env } from "../types";

export const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get("/", (c) =>
  c.json({
    ok: true,
    service: "umbral-perimeter-os",
    timestamp: new Date().toISOString(),
  })
);
