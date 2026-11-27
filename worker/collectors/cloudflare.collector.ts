/**
 * ============================================================================
 * Recolector Automático — Seguridad Perimetral Cloudflare (Cada 5 min)
 * ============================================================================
 * Consulta Cloudflare GraphQL Analytics API exclusivamente para los `zone_id`
 * configurados en `config/sites.config.ts`, descarta cualquier host ajeno,
 * persiste eventos WAF/DDoS/Rate-Limit en D1 y genera incidencias agrupadas.
 */

import { insertSecurityEventIgnoreDuplicate } from "../repositories/security-events.repo";
import { updateCloudflareSyncTimestamp } from "../repositories/uptime.repo";
import { findSiteByZoneAndHost, getSitesWithCloudflareZone } from "../security/allowlist";
import { sha256ShortId } from "../security/crypto";
import { upsertIncident } from "../services/incidents.service";
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
    return { skipped: true, zonesSynced: 0, totalEventsIngested: 0 };
  }

  const sitesWithZone = getSitesWithCloudflareZone(env);
  if (sitesWithZone.length === 0) {
    return { skipped: true, zonesSynced: 0, totalEventsIngested: 0 };
  }

  const uniqueZones = Array.from(
    new Set(sitesWithZone.map((s) => s.cloudflareZoneId!.trim()))
  );

  const now = new Date();
  const since = new Date(now.getTime() - 10 * 60_000).toISOString();
  const until = now.toISOString();
  const syncTimestamp = now.toISOString();

  let totalEventsIngested = 0;

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
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;

      const json = (await res.json()) as CfGraphQLResponse;
      const zoneData = json.data?.viewer?.zones?.[0];
      const fwEvents = zoneData?.firewallEventsAdaptive ?? [];

      const eventsBySite = new Map<string, CfFirewallEvent[]>();

      for (const ev of fwEvents) {
        const matchedSite = findSiteByZoneAndHost(env, zoneTag, ev.clientRequestHTTPHost);
        if (!matchedSite) continue;

        const eventId = await sha256ShortId(
          "cf",
          `${matchedSite.id}|${ev.rayName ?? ""}|${ev.datetime}|${ev.action}|${ev.ruleId ?? ""}|${ev.clientIP}`
        );

        const inserted = await insertSecurityEventIgnoreDuplicate(env.DB, {
          id: eventId,
          siteId: matchedSite.id,
          occurredAt: ev.datetime,
          source: "cloudflare-waf",
          action: (ev.action ?? "unknown").slice(0, 40),
          ruleId: ev.ruleId?.slice(0, 80) ?? null,
          ruleSource: ev.source?.slice(0, 60) ?? null,
          clientIp: ev.clientIP?.slice(0, 64) ?? null,
          country: ev.clientCountryName?.slice(0, 8) ?? null,
          host: (ev.clientRequestHTTPHost ?? matchedSite.domain).slice(0, 255),
          path: (ev.clientRequestPath ?? "/").slice(0, 300),
          method: ev.clientRequestHTTPMethodName?.slice(0, 12) ?? null,
          userAgent: ev.userAgent?.slice(0, 250) ?? null,
          metadataJson: JSON.stringify({ rayName: ev.rayName }),
        });

        if (inserted) {
          totalEventsIngested += 1;
          const list = eventsBySite.get(matchedSite.id) ?? [];
          list.push(ev);
          eventsBySite.set(matchedSite.id, list);
        }
      }

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
            description: `Cloudflare registró ${newEvents.length} eventos de firewall en la última ventana.`,
            occurrencesDelta: newEvents.length,
            metadata: { topIps, topPaths, actions: actionCounts },
          });
        }
      }

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
          metadata: { total5xx },
        });
      }

      for (const s of zoneSites) {
        await updateCloudflareSyncTimestamp(env.DB, s.id, syncTimestamp);
      }
    } catch {
      // Continuar con el siguiente Zone ID sin interrumpir el lote completo
    }
  }

  return {
    skipped: false,
    zonesSynced: uniqueZones.length,
    totalEventsIngested,
  };
}
