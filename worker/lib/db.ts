import type {
  Env,
  IncidentCategory,
  IncidentRow,
  IncidentSeverity,
  IncidentSource,
} from "../types";
import { getAllowedSite } from "./allowlist";
import { sendIncidentAlert } from "./alerts";

const SEVERITY_RANK: Record<IncidentSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export interface UpsertIncidentInput {
  siteId: string;
  fingerprint: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  source: IncidentSource;
  title: string;
  description: string;
  occurrencesDelta?: number;
  metadata?: Record<string, unknown>;
}

export async function upsertIncident(
  env: Env,
  input: UpsertIncidentInput
): Promise<{ id: string; created: boolean }> {
  const site = getAllowedSite(input.siteId);
  if (!site) {
    throw new Error(`Sitio no autorizado en allowlist: ${input.siteId}`);
  }

  const now = new Date().toISOString();
  const delta = Math.max(1, input.occurrencesDelta ?? 1);

  const existing = await env.DB.prepare(
    `SELECT * FROM incidents
     WHERE site_id = ? AND fingerprint = ? AND status IN ('open', 'investigating')
     ORDER BY last_seen_at DESC
     LIMIT 1`
  )
    .bind(input.siteId, input.fingerprint)
    .first<IncidentRow>();

  if (existing) {
    const prevRank = SEVERITY_RANK[existing.severity];
    const nextRank = SEVERITY_RANK[input.severity];
    const finalSeverity = nextRank > prevRank ? input.severity : existing.severity;

    let mergedMeta: Record<string, unknown> = {};
    try {
      mergedMeta = JSON.parse(existing.metadata_json || "{}") as Record<string, unknown>;
    } catch {
      mergedMeta = {};
    }
    if (input.metadata) {
      mergedMeta = { ...mergedMeta, ...input.metadata };
    }

    const nextOccurrences = existing.occurrences + delta;

    await env.DB.prepare(
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
        finalSeverity,
        input.title,
        input.description,
        nextOccurrences,
        now,
        JSON.stringify(mergedMeta),
        existing.id
      )
      .run();

    if (nextRank > prevRank && nextRank >= SEVERITY_RANK.high) {
      await sendIncidentAlert(env, {
        event: "escalated",
        siteName: site.name,
        siteDomain: site.domain,
        category: input.category,
        severity: finalSeverity,
        title: input.title,
        description: input.description,
        occurrences: nextOccurrences,
      });
    }

    return { id: existing.id, created: false };
  }

  const id = `inc_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;

  await env.DB.prepare(
    `INSERT INTO incidents
      (id, site_id, fingerprint, category, severity, source, status, title, description, occurrences, started_at, last_seen_at, resolved_at, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, NULL, ?)`
  )
    .bind(
      id,
      input.siteId,
      input.fingerprint,
      input.category,
      input.severity,
      input.source,
      input.title,
      input.description,
      delta,
      now,
      now,
      JSON.stringify(input.metadata ?? {})
    )
    .run();

  await sendIncidentAlert(env, {
    event: "opened",
    siteName: site.name,
    siteDomain: site.domain,
    category: input.category,
    severity: input.severity,
    title: input.title,
    description: input.description,
    occurrences: delta,
  });

  return { id, created: true };
}

export async function resolveIncidentByFingerprint(
  env: Env,
  siteId: string,
  fingerprint: string,
  recoveryDescription?: string
): Promise<boolean> {
  const site = getAllowedSite(siteId);
  if (!site) return false;

  const existing = await env.DB.prepare(
    `SELECT * FROM incidents
     WHERE site_id = ? AND fingerprint = ? AND status IN ('open', 'investigating')
     ORDER BY last_seen_at DESC
     LIMIT 1`
  )
    .bind(siteId, fingerprint)
    .first<IncidentRow>();

  if (!existing) return false;

  const now = new Date().toISOString();
  const nextDesc = recoveryDescription
    ? `${existing.description} — ${recoveryDescription}`
    : existing.description;

  await env.DB.prepare(
    `UPDATE incidents
     SET status = 'resolved',
         resolved_at = ?,
         last_seen_at = ?,
         description = ?
     WHERE id = ?`
  )
    .bind(now, now, nextDesc, existing.id)
    .run();

  await sendIncidentAlert(env, {
    event: "resolved",
    siteName: site.name,
    siteDomain: site.domain,
    category: existing.category,
    severity: existing.severity,
    title: existing.title,
    description: recoveryDescription ?? "Incidencia resuelta automáticamente.",
    occurrences: existing.occurrences,
  });

  return true;
}

export async function pruneOldRecords(env: Env): Promise<void> {
  const retentionDays = Math.max(7, Number(env.RETENTION_DAYS ?? "90") || 90);
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();

  await env.DB.batch([
    env.DB.prepare("DELETE FROM uptime_checks WHERE checked_at < ?").bind(cutoff),
    env.DB.prepare("DELETE FROM security_events WHERE occurred_at < ?").bind(cutoff),
  ]);
}
