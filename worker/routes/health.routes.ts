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
