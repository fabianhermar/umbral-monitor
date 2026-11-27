/**
 * ============================================================================
 * Constantes de Seguridad, Límites y Validación del Backend
 * ============================================================================
 * Agrupa valores mágicos y reglas de validación en un único módulo legible.
 */

import type { IncidentCategory, IncidentSeverity, IncidentStatus } from "../types";

export const VALID_CATEGORIES = new Set<IncidentCategory>([
  "downtime",
  "attack",
  "block",
  "security",
  "error",
  "deployment",
]);

export const VALID_SEVERITIES = new Set<IncidentSeverity>([
  "low",
  "medium",
  "high",
  "critical",
]);

export const VALID_STATUSES = new Set<IncidentStatus>([
  "open",
  "investigating",
  "resolved",
]);

export const SEVERITY_RANK: Record<IncidentSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/** Códigos HTTP propios de Cloudflare cuando falla la conexión con el origen (Vercel) */
export const CF_ORIGIN_ERROR_CODES = new Set([520, 521, 522, 523, 524, 525, 526, 530]);

/** Límites defensivos para evitar abuso de memoria o payloads maliciosos */
export const SECURITY_LIMITS = {
  MAX_INGEST_BODY_BYTES: 32_768,
  INGEST_TIMESTAMP_TOLERANCE_SEC: 300,
  MIN_SITE_SECRET_LENGTH: 16,
  UPTIME_TIMEOUT_MS: 10_000,
  MANUAL_CHECK_COOLDOWN_MS: 15_000,
  AUTH_MAX_FAILURES_PER_MIN: 15,
  INGEST_MAX_REQUESTS_PER_MIN: 120,
} as const;

/** Política Content-Security-Policy aplicada al propio dashboard UMBRAL */
export const DASHBOARD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");
