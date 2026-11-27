/**
 * ============================================================================
 * Repositorio SQL D1 — Tablas `uptime_checks` y `site_runtime_state`
 * ============================================================================
 * Gestiona todas las lecturas y escrituras de chequeos de disponibilidad,
 * latencia y estado operativo en tiempo real por dominio.
 */

import type {
  SiteOperationalStatus,
  SiteRuntimeStateRow,
  UptimeCheckRow,
} from "../types";

export async function insertUptimeCheck(
  db: D1Database,
  params: {
    siteId: string;
    checkedAt: string;
    ok: boolean;
    statusCode: number | null;
    latencyMs: number;
    errorMessage: string | null;
    cfRay: string | null;
    securityScore: number;
    missingHeadersJson: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO uptime_checks
        (site_id, checked_at, ok, status_code, latency_ms, error_message, cf_ray, security_score, missing_headers)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      params.siteId,
      params.checkedAt,
      params.ok ? 1 : 0,
      params.statusCode,
      params.latencyMs,
      params.errorMessage,
      params.cfRay,
      params.securityScore,
      params.missingHeadersJson
    )
    .run();
}

export async function getSiteRuntimeState(
  db: D1Database,
  siteId: string
): Promise<SiteRuntimeStateRow | null> {
  return db
    .prepare("SELECT * FROM site_runtime_state WHERE site_id = ?")
    .bind(siteId)
    .first<SiteRuntimeStateRow>();
}

export async function getAllSiteRuntimeStates(
  db: D1Database
): Promise<SiteRuntimeStateRow[]> {
  const res = await db.prepare("SELECT * FROM site_runtime_state").all<SiteRuntimeStateRow>();
  return res.results;
}

export async function upsertSiteUptimeState(
  db: D1Database,
  siteId: string,
  consecutiveFailures: number,
  lastStatus: SiteOperationalStatus,
  checkedAt: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO site_runtime_state (site_id, consecutive_failures, last_status, last_checked_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(site_id) DO UPDATE SET
         consecutive_failures = excluded.consecutive_failures,
         last_status = excluded.last_status,
         last_checked_at = excluded.last_checked_at`
    )
    .bind(siteId, consecutiveFailures, lastStatus, checkedAt)
    .run();
}

export async function updateCloudflareSyncTimestamp(
  db: D1Database,
  siteId: string,
  syncedAt: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO site_runtime_state (site_id, last_cf_sync_at)
       VALUES (?, ?)
       ON CONFLICT(site_id) DO UPDATE SET last_cf_sync_at = excluded.last_cf_sync_at`
    )
    .bind(siteId, syncedAt)
    .run();
}

export async function updateVercelDeploymentState(
  db: D1Database,
  siteId: string,
  syncedAt: string,
  deploymentId: string,
  state: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO site_runtime_state
        (site_id, last_vercel_sync_at, last_vercel_deployment_id, last_vercel_deployment_state)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(site_id) DO UPDATE SET
         last_vercel_sync_at = excluded.last_vercel_sync_at,
         last_vercel_deployment_id = excluded.last_vercel_deployment_id,
         last_vercel_deployment_state = excluded.last_vercel_deployment_state`
    )
    .bind(siteId, syncedAt, deploymentId, state)
    .run();
}

export async function listRecentUptimeChecksSince(
  db: D1Database,
  sinceIso: string,
  limit = 1500
): Promise<UptimeCheckRow[]> {
  const res = await db
    .prepare(
      `SELECT id, site_id, checked_at, ok, status_code, latency_ms, security_score, missing_headers
       FROM uptime_checks
       WHERE checked_at >= ?
       ORDER BY checked_at DESC
       LIMIT ?`
    )
    .bind(sinceIso, limit)
    .all<UptimeCheckRow>();
  return res.results;
}

export async function listUptimeSeries(
  db: D1Database,
  sinceIso: string,
  siteId?: string,
  limit = 600
) {
  const whereParts = ["checked_at >= ?"];
  const bindings: unknown[] = [sinceIso];

  if (siteId) {
    whereParts.push("site_id = ?");
    bindings.push(siteId);
  }

  const res = await db
    .prepare(
      `SELECT site_id, checked_at, ok, status_code, latency_ms
       FROM uptime_checks
       WHERE ${whereParts.join(" AND ")}
       ORDER BY checked_at ASC
       LIMIT ?`
    )
    .bind(...bindings, limit)
    .all<Pick<UptimeCheckRow, "site_id" | "checked_at" | "ok" | "status_code" | "latency_ms">>();

  return res.results;
}
