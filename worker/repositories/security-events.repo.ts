/**
 * ============================================================================
 * Repositorio SQL D1 — Tabla `security_events`
 * ============================================================================
 * Gestiona eventos detallados de firewall (Cloudflare WAF, DDoS, Bots, Rate
 * Limit) y bloqueos enviados desde el SDK de Vercel.
 */

import type { SecurityEventRow } from "../types";

export async function insertSecurityEventIgnoreDuplicate(
  db: D1Database,
  params: {
    id: string;
    siteId: string;
    occurredAt: string;
    source: "cloudflare-waf" | "app-sdk";
    action: string;
    ruleId: string | null;
    ruleSource: string | null;
    clientIp: string | null;
    country: string | null;
    host: string;
    path: string;
    method: string | null;
    userAgent: string | null;
    metadataJson: string;
  }
): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO security_events
        (id, site_id, occurred_at, source, action, rule_id, rule_source, client_ip, country, host, path, method, user_agent, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      params.id,
      params.siteId,
      params.occurredAt,
      params.source,
      params.action,
      params.ruleId,
      params.ruleSource,
      params.clientIp,
      params.country,
      params.host,
      params.path,
      params.method,
      params.userAgent,
      params.metadataJson
    )
    .run();

  return (res.meta?.changes ?? 0) > 0;
}

export async function countSecurityEventsSinceBySite(
  db: D1Database,
  sinceIso: string
): Promise<Array<{ site_id: string; count: number }>> {
  const res = await db
    .prepare(
      `SELECT site_id, COUNT(*) as count
       FROM security_events
       WHERE occurred_at >= ?
       GROUP BY site_id`
    )
    .bind(sinceIso)
    .all<{ site_id: string; count: number }>();
  return res.results;
}

export async function getSecurityBreakdown24h(
  db: D1Database,
  since24hIso: string,
  siteId?: string,
  limit = 60
) {
  const whereParts: string[] = [];
  const bindings: unknown[] = [];

  if (siteId) {
    whereParts.push("site_id = ?");
    bindings.push(siteId);
  }

  const whereEvents = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
  const where24h = `WHERE occurred_at >= ?${
    whereParts.length > 0 ? ` AND ${whereParts.join(" AND ")}` : ""
  }`;

  const [eventsRes, topIpsRes, actionsRes, topPathsRes] = await Promise.all([
    db
      .prepare(`SELECT * FROM security_events ${whereEvents} ORDER BY occurred_at DESC LIMIT ?`)
      .bind(...bindings, limit)
      .all<SecurityEventRow>(),
    db
      .prepare(
        `SELECT client_ip as ip, country, COUNT(*) as count
         FROM security_events
         ${where24h} AND client_ip IS NOT NULL
         GROUP BY client_ip, country
         ORDER BY count DESC
         LIMIT 8`
      )
      .bind(since24hIso, ...bindings)
      .all<{ ip: string; country: string | null; count: number }>(),
    db
      .prepare(
        `SELECT action, COUNT(*) as count
         FROM security_events
         ${where24h}
         GROUP BY action
         ORDER BY count DESC`
      )
      .bind(since24hIso, ...bindings)
      .all<{ action: string; count: number }>(),
    db
      .prepare(
        `SELECT path, COUNT(*) as count
         FROM security_events
         ${where24h} AND path IS NOT NULL
         GROUP BY path
         ORDER BY count DESC
         LIMIT 8`
      )
      .bind(since24hIso, ...bindings)
      .all<{ path: string; count: number }>()
  ]);

  return {
    events: eventsRes.results,
    topIps: topIpsRes.results,
    actionsBreakdown: actionsRes.results,
    topPaths: topPathsRes.results,
  };
}
