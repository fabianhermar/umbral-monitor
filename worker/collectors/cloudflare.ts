import { findSiteByZoneAndHost, getSitesWithCloudflareZone } from "../lib/allowlist";
import { sha256ShortId } from "../lib/crypto";
import { upsertIncident } from "../lib/db";
import type { Env } from "../types";

interface CfFirewallEvent {
  action: string;
  clientIP: string;
  clientCountryName?: string;
  clientRequestHTTPHost?: string;
  clientRequestHTTPMethodName?: string;
  clientRequestPath?: string;
  datetime: string;
  rayName?: string;
  ruleId?: string;
  source?: string;
  userAgent?: string;
}

interface CfHttpGroup {
  sum?: {
    requests?: number;
    threats?: number;
    responseStatusMap?: Array<{ edgeResponseStatus: number; requests: number }>;
  };
}

interface CfGraphQLResponse {
  data?: {
    viewer?: {
      zones?: Array<{
        firewallEventsAdaptive?: CfFirewallEvent[];
        httpRequests1mGroups?: CfHttpGroup[];
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

const CF_GRAPHQL_QUERY = `
query SecuritySync($zoneTag: string!, $since: Time!, $until: Time!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      firewallEventsAdaptive(
        filter: { datetime_geq: $since, datetime_leq: $until }
        limit: 200
        orderBy: [datetime_DESC]
      ) {
        action
        clientIP
        clientCountryName
        clientRequestHTTPHost
        clientRequestHTTPMethodName
        clientRequestPath
        datetime
        rayName
        ruleId
        source
        userAgent
      }
      httpRequests1mGroups(
        filter: { datetime_geq: $since, datetime_leq: $until }
        limit: 15
      ) {
        sum {
          requests
          threats
          responseStatusMap {
            edgeResponseStatus
            requests
          }
        }
      }
    }
  }
}
`;

export async function syncCloudflareSecurity(env: Env) {
  if (!env.CLOUDFLARE_API_TOKEN) {
    return { skipped: true, reason: "CLOUDFLARE_API_TOKEN no configurado", zonesSynced: 0 };
  }

  const sitesWithZone = getSitesWithCloudflareZone();
  if (sitesWithZone.length === 0) {
    return { skipped: true, reason: "Ningún sitio tiene cloudflareZoneId configurado", zonesSynced: 0 };
  }

  const uniqueZones = Array.from(
    new Set(sitesWithZone.map((s) => s.cloudflareZoneId!.trim()))
  );

  const now = new Date();
  const since = new Date(now.getTime() - 10 * 60_000).toISOString();
  const until = now.toISOString();
  const syncTimestamp = now.toISOString();

  let totalEventsIngested = 0;
  const errors: string[] = [];

  for (const zoneTag of uniqueZones) {
    try {
      const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: CF_GRAPHQL_QUERY,
          variables: { zoneTag, since, until },
        }),
      });

      if (!res.ok) {
        errors.push(`Zone ${zoneTag}: HTTP ${res.status}`);
        continue;
      }

      const json = (await res.json()) as CfGraphQLResponse;
      if (json.errors?.length) {
        errors.push(`Zone ${zoneTag}: ${json.errors.map((e) => e.message).join("; ")}`);
      }

      const zoneData = json.data?.viewer?.zones?.[0];
      const fwEvents = zoneData?.firewallEventsAdaptive ?? [];

      // Agrupar eventos por sitio estrictamente validado en nuestra allowlist
      const eventsBySite = new Map<string, CfFirewallEvent[]>();

      for (const ev of fwEvents) {
        const matchedSite = findSiteByZoneAndHost(zoneTag, ev.clientRequestHTTPHost);
        if (!matchedSite) {
          // Host fuera de nuestra lista blanca -> ignorar estrictamente
          continue;
        }

        const eventId = await sha256ShortId(
          "cf",
          `${matchedSite.id}|${ev.rayName ?? ""}|${ev.datetime}|${ev.action}|${ev.ruleId ?? ""}|${ev.clientIP}`
        );

        const insertRes = await env.DB.prepare(
          `INSERT OR IGNORE INTO security_events
            (id, site_id, occurred_at, source, action, rule_id, rule_source, client_ip, country, host, path, method, user_agent, metadata_json)
           VALUES (?, ?, ?, 'cloudflare-waf', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            eventId,
            matchedSite.id,
            ev.datetime,
            ev.action ?? "unknown",
            ev.ruleId ?? null,
            ev.source ?? null,
            ev.clientIP ?? null,
            ev.clientCountryName ?? null,
            ev.clientRequestHTTPHost ?? matchedSite.domain,
            ev.clientRequestPath ?? "/",
            ev.clientRequestHTTPMethodName ?? null,
            ev.userAgent ?? null,
            JSON.stringify({ rayName: ev.rayName })
          )
          .run();

        if ((insertRes.meta?.changes ?? 0) > 0) {
          totalEventsIngested += 1;
          const list = eventsBySite.get(matchedSite.id) ?? [];
          list.push(ev);
          eventsBySite.set(matchedSite.id, list);
        }
      }

      // Evaluar umbrales de incidencias por sitio
      for (const [siteId, newEvents] of eventsBySite.entries()) {
        const site = sitesWithZone.find((s) => s.id === siteId);
        if (!site) continue;

        const ddosEvents = newEvents.filter((e) =>
          (e.source ?? "").toLowerCase().includes("ddos")
        );
        const rateLimitEvents = newEvents.filter((e) =>
          (e.source ?? "").toLowerCase().includes("ratelimit")
        );

        const topIps = Array.from(new Set(newEvents.map((e) => e.clientIP).filter(Boolean))).slice(
          0,
          5
        );
        const topPaths = Array.from(
          new Set(newEvents.map((e) => e.clientRequestPath).filter(Boolean))
        ).slice(0, 5);
        const actionCounts: Record<string, number> = {};
        for (const e of newEvents) {
          actionCounts[e.action] = (actionCounts[e.action] ?? 0) + 1;
        }

        if (ddosEvents.length > 0) {
          await upsertIncident(env, {
            siteId,
            fingerprint: `cf-ddos:${siteId}`,
            category: "attack",
            severity: "critical",
            source: "cloudflare-waf",
            title: `Mitigación DDoS L7 activa en ${site.name}`,
            description: `Cloudflare mitigó ${ddosEvents.length} eventos DDoS recientes dirigidos a ${site.domain}.`,
            occurrencesDelta: ddosEvents.length,
            metadata: { topIps, topPaths, actions: actionCounts },
          });
        }

        if (rateLimitEvents.length >= 5) {
          await upsertIncident(env, {
            siteId,
            fingerprint: `cf-ratelimit:${siteId}`,
            category: "block",
            severity: "medium",
            source: "cloudflare-waf",
            title: `Bloqueos por Rate Limiting en ${site.name}`,
            description: `Se bloquearon ${rateLimitEvents.length} peticiones por exceso de tasa en ${site.domain}.`,
            occurrencesDelta: rateLimitEvents.length,
            metadata: { topIps, topPaths, actions: actionCounts },
          });
        }

        if (newEvents.length >= site.attackAlertThreshold5m) {
          await upsertIncident(env, {
            siteId,
            fingerprint: `cf-waf-spike:${siteId}`,
            category: "attack",
            severity: newEvents.length >= site.attackAlertThreshold5m * 3 ? "critical" : "high",
            source: "cloudflare-waf",
            title: `Pico de bloqueos/ataques en Cloudflare WAF (${site.name})`,
            description: `Cloudflare registró ${newEvents.length} eventos de firewall (bloqueos/desafíos) en la última ventana.`,
            occurrencesDelta: newEvents.length,
            metadata: { topIps, topPaths, actions: actionCounts },
          });
        }
      }

      // Evaluar picos de errores 5xx agregados a nivel de zona
      const httpGroups = zoneData?.httpRequests1mGroups ?? [];
      let total5xx = 0;
      for (const group of httpGroups) {
        for (const entry of group.sum?.responseStatusMap ?? []) {
          if (entry.edgeResponseStatus >= 500) {
            total5xx += entry.requests;
          }
        }
      }

      const zoneSites = sitesWithZone.filter((s) => s.cloudflareZoneId === zoneTag);
      if (total5xx >= 15 && zoneSites.length > 0) {
        const primarySite = zoneSites[0];
        await upsertIncident(env, {
          siteId: primarySite.id,
          fingerprint: `cf-5xx-spike:${zoneTag}`,
          category: "downtime",
          severity: total5xx >= 50 ? "critical" : "high",
          source: "cloudflare-http",
          title: `Pico de errores 5xx detectado en Cloudflare (${primarySite.domain})`,
          description: `Cloudflare contabilizó ${total5xx} respuestas 5xx en los últimos 10 minutos.`,
          occurrencesDelta: total5xx,
          metadata: { zoneTag, total5xx },
        });
      }

      // Actualizar timestamp de sincronización de Cloudflare
      for (const s of zoneSites) {
        await env.DB.prepare(
          `INSERT INTO site_runtime_state (site_id, last_cf_sync_at)
           VALUES (?, ?)
           ON CONFLICT(site_id) DO UPDATE SET last_cf_sync_at = excluded.last_cf_sync_at`
        )
          .bind(s.id, syncTimestamp)
          .run();
      }
    } catch (err) {
      errors.push(`Zone ${zoneTag}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    skipped: false,
    zonesSynced: uniqueZones.length,
    totalEventsIngested,
    errors,
  };
}
