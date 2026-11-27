/**
 * ============================================================================
 * Repositorio SQL D1 — Tabla `incidents`
 * ============================================================================
 * Encapsula únicamente consultas SQL parametrizadas sobre incidencias,
 * separando el acceso a datos de la lógica de negocio y las rutas HTTP.
 */

import { VALID_CATEGORIES, VALID_SEVERITIES, VALID_STATUSES } from "../constants/security";
import type {
  IncidentCategory,
  IncidentRow,
  IncidentSeverity,
  IncidentSource,
  IncidentStatus,
} from "../types";

export async function findActiveIncidentByFingerprint(
  db: D1Database,
  siteId: string,
  fingerprint: string
): Promise<IncidentRow | null> {
  return db
    .prepare(
      `SELECT * FROM incidents
       WHERE site_id = ? AND fingerprint = ? AND status IN ('open', 'investigating')
       ORDER BY last_seen_at DESC
       LIMIT 1`
    )
    .bind(siteId, fingerprint)
    .first<IncidentRow>();
}

export async function insertIncidentRow(
  db: D1Database,
  params: {
    id: string;
    siteId: string;
    fingerprint: string;
    category: IncidentCategory;
    severity: IncidentSeverity;
    source: IncidentSource;
    title: string;
    description: string;
    occurrences: number;
    now: string;
    metadataJson: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO incidents
        (id, site_id, fingerprint, category, severity, source, status, title, description, occurrences, started_at, last_seen_at, resolved_at, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, NULL, ?)`
    )
    .bind(
      params.id,
      params.siteId,
      params.fingerprint,
      params.category,
      params.severity,
      params.source,
      params.title,
      params.description,
      params.occurrences,
      params.now,
      params.now,
      params.metadataJson
    )
    .run();
}

export async function updateExistingIncidentRow(
  db: D1Database,
  params: {
    id: string;
    severity: IncidentSeverity;
    title: string;
    description: string;
    occurrences: number;
    lastSeenAt: string;
    metadataJson: string;
  }
): Promise<void> {
  await db
    .prepare(
      `UPDATE incidents
       SET severity = ?,
           title = ?,
           description = ?,
           occurrences = ?,
           last_seen_at = ?,
           metadata_json = ?
       WHERE id = ?`
    )
    .bind(
      params.severity,
      params.title,
      params.description,
      params.occurrences,
      params.lastSeenAt,
      params.metadataJson,
      params.id
    )
    .run();
}

export async function markIncidentResolved(
  db: D1Database,
  id: string,
  now: string,
  description: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE incidents
       SET status = 'resolved',
           resolved_at = ?,
           last_seen_at = ?,
           description = ?
       WHERE id = ?`
    )
    .bind(now, now, description, id)
    .run();
}

export async function updateIncidentStatusById(
  db: D1Database,
  id: string,
  status: IncidentStatus,
  resolvedAt: string | null
): Promise<boolean> {
  const res = await db
    .prepare(`UPDATE incidents SET status = ?, resolved_at = ? WHERE id = ?`)
    .bind(status, resolvedAt, id)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function bulkUpdateIncidentStatus(
  db: D1Database,
  ids: string[],
  status: IncidentStatus,
  resolvedAt: string | null
): Promise<number> {
  if (ids.length === 0) return 0;
  const safeIds = ids.slice(0, 100);
  const placeholders = safeIds.map(() => "?").join(", ");
  const res = await db
    .prepare(`UPDATE incidents SET status = ?, resolved_at = ? WHERE id IN (${placeholders})`)
    .bind(status, resolvedAt, ...safeIds)
    .run();
  return res.meta?.changes ?? 0;
}

export async function getAverageMttrMinutes30d(db: D1Database, sinceIso: string): Promise<number | null> {
  const row = await db
    .prepare(
      `SELECT AVG((julianday(resolved_at) - julianday(started_at)) * 1440.0) AS avg_mins
       FROM incidents
       WHERE status = 'resolved'
         AND resolved_at IS NOT NULL
         AND started_at >= ?`
    )
    .bind(sinceIso)
    .first<{ avg_mins: number | null }>();

  if (row?.avg_mins === null || row?.avg_mins === undefined || !Number.isFinite(row.avg_mins)) {
    return null;
  }
  return Math.max(1, Math.round(row.avg_mins));
}

export async function countActiveIncidentsGrouped(db: D1Database) {
  const res = await db
    .prepare(
      `SELECT site_id, category, severity, status, COUNT(*) as count
       FROM incidents
       WHERE status IN ('open', 'investigating')
       GROUP BY site_id, category, severity, status`
    )
    .all<{
      site_id: string;
      category: string;
      severity: string;
      status: string;
      count: number;
    }>();
  return res.results;
}

export async function listIncidentsFiltered(
  db: D1Database,
  filters: {
    siteId?: string;
    category?: string;
    severity?: string;
    status?: string;
    limit: number;
  }
): Promise<IncidentRow[]> {
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (filters.siteId) {
    conditions.push("site_id = ?");
    bindings.push(filters.siteId);
  }
  if (filters.category && VALID_CATEGORIES.has(filters.category as IncidentCategory)) {
    conditions.push("category = ?");
    bindings.push(filters.category);
  }
  if (filters.severity && VALID_SEVERITIES.has(filters.severity as IncidentSeverity)) {
    conditions.push("severity = ?");
    bindings.push(filters.severity);
  }
  if (filters.status && filters.status !== "all") {
    if (filters.status === "active") {
      conditions.push("status IN ('open', 'investigating')");
    } else if (VALID_STATUSES.has(filters.status as IncidentStatus)) {
      conditions.push("status = ?");
      bindings.push(filters.status);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `
    SELECT * FROM incidents
    ${where}
    ORDER BY CASE status WHEN 'open' THEN 1 WHEN 'investigating' THEN 2 ELSE 3 END,
             last_seen_at DESC
    LIMIT ?
  `;

  const result = await db
    .prepare(sql)
    .bind(...bindings, filters.limit)
    .all<IncidentRow>();
  return result.results;
}
