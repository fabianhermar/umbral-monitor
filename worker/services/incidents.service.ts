/**
 * ============================================================================
 * Servicio de Dominio — Gestión de Incidencias y Retención
 * ============================================================================
 * Orquesta la deduplicación por `fingerprint`, escalado de severidad,
 * cierre automático ante recuperación y purga de registros históricos.
 */

import { SEVERITY_RANK } from "../constants/security";
import {
  findActiveIncidentByFingerprint,
  insertIncidentRow,
  markIncidentResolved,
  updateExistingIncidentRow,
} from "../repositories/incidents.repo";
import { isSiteCurrentlyMuted } from "../repositories/uptime.repo";
import { getAllowedSite } from "../security/allowlist";
import type { Env, IncidentCategory, IncidentSeverity, IncidentSource } from "../types";
import { sanitizeMetadata } from "../validators/ingest.validator";
import { sendIncidentAlert } from "./alerts.service";

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
  const site = getAllowedSite(env, input.siteId);
  if (!site) {
    throw new Error(`Sitio no autorizado en lista blanca: ${input.siteId}`);
  }

  const now = new Date().toISOString();
  const delta = Math.max(1, input.occurrencesDelta ?? 1);
  const safeIncomingMeta = sanitizeMetadata(input.metadata);

  const existing = await findActiveIncidentByFingerprint(
    env.DB,
    input.siteId,
    input.fingerprint
  );

  if (existing) {
    const prevRank = SEVERITY_RANK[existing.severity];
    const nextRank = SEVERITY_RANK[input.severity];
    const finalSeverity = nextRank > prevRank ? input.severity : existing.severity;

    let existingMeta: Record<string, unknown> = {};
    try {
      existingMeta = sanitizeMetadata(JSON.parse(existing.metadata_json || "{}"));
    } catch {
      existingMeta = {};
    }

    const mergedMeta = { ...existingMeta, ...safeIncomingMeta };
    const nextOccurrences = existing.occurrences + delta;

    await updateExistingIncidentRow(env.DB, {
      id: existing.id,
      severity: finalSeverity,
      title: input.title,
      description: input.description,
      occurrences: nextOccurrences,
      lastSeenAt: now,
      metadataJson: JSON.stringify(mergedMeta),
    });

    if (nextRank > prevRank && nextRank >= SEVERITY_RANK.high) {
      const muted = await isSiteCurrentlyMuted(env.DB, input.siteId);
      if (!muted) {
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
    }

    return { id: existing.id, created: false };
  }

  const id = `inc_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;

  await insertIncidentRow(env.DB, {
    id,
    siteId: input.siteId,
    fingerprint: input.fingerprint,
    category: input.category,
    severity: input.severity,
    source: input.source,
    title: input.title,
    description: input.description,
    occurrences: delta,
    now,
    metadataJson: JSON.stringify(safeIncomingMeta),
  });

  const muted = await isSiteCurrentlyMuted(env.DB, input.siteId);
  if (!muted) {
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
  }

  return { id, created: true };
}

export async function resolveIncidentByFingerprint(
  env: Env,
  siteId: string,
  fingerprint: string,
  recoveryDescription?: string
): Promise<boolean> {
  const site = getAllowedSite(env, siteId);
  if (!site) return false;

  const existing = await findActiveIncidentByFingerprint(env.DB, siteId, fingerprint);
  if (!existing) return false;

  const now = new Date().toISOString();
  const nextDesc = recoveryDescription
    ? `${existing.description} — ${recoveryDescription}`
    : existing.description;

  await markIncidentResolved(env.DB, existing.id, now, nextDesc);

  const muted = await isSiteCurrentlyMuted(env.DB, siteId);
  if (!muted) {
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
  }

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
