/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  worker/security/allowlist.ts
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
 * Guardia de Lista Blanca (Allowlist) de Dominios Propios
 * ============================================================================
 * Soporta dos fuentes exclusivas (ninguna modificable por usuarios externos):
 *  1. `env.SITES_CONFIG_JSON` (recomendado si tu repo en GitHub es público):
 *     mantiene tus dominios reales, Zone IDs y Project IDs en Cloudflare Secrets.
 *  2. `config/sites.config.ts` (respaldo estático cuando no existe el secreto).
 */

import { MY_SITES, type SiteConfig } from "../../config/sites.config";
import type { Env } from "../types";

let cachedRawJson: string | undefined;
let cachedParsedSites: readonly SiteConfig[] | null = null;

function parseSitesFromSecret(rawJson: string): readonly SiteConfig[] | null {
  if (rawJson === cachedRawJson && cachedParsedSites) {
    return cachedParsedSites;
  }

  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const validSites: SiteConfig[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const obj = item as Record<string, unknown>;
      if (
        typeof obj.id !== "string" ||
        typeof obj.name !== "string" ||
        typeof obj.domain !== "string" ||
        typeof obj.checkUrl !== "string" ||
        !obj.checkUrl.startsWith("https://")
      ) {
        continue;
      }

      const allowedHosts = Array.isArray(obj.allowedHosts)
        ? obj.allowedHosts.filter((h): h is string => typeof h === "string" && h.trim().length > 0)
        : [obj.domain, `www.${obj.domain}`];

      validSites.push({
        id: obj.id.trim(),
        name: obj.name.trim(),
        domain: obj.domain.trim().toLowerCase(),
        allowedHosts,
        checkUrl: obj.checkUrl.trim(),
        expectedStatus: Array.isArray(obj.expectedStatus)
          ? obj.expectedStatus.filter((n): n is number => typeof n === "number")
          : [200, 204, 301, 302, 307, 308],
        latencyWarnMs: typeof obj.latencyWarnMs === "number" ? obj.latencyWarnMs : 2500,
        cloudflareZoneId:
          typeof obj.cloudflareZoneId === "string" ? obj.cloudflareZoneId.trim() : "",
        vercelProjectId:
          typeof obj.vercelProjectId === "string" ? obj.vercelProjectId.trim() : "",
        vercelTeamId:
          typeof obj.vercelTeamId === "string" ? obj.vercelTeamId.trim() : undefined,
        checkSecurityHeaders: obj.checkSecurityHeaders !== false,
        attackAlertThreshold5m:
          typeof obj.attackAlertThreshold5m === "number" ? obj.attackAlertThreshold5m : 15,
      });
    }

    if (validSites.length === 0) return null;

    cachedRawJson = rawJson;
    cachedParsedSites = validSites;
    return validSites;
  } catch {
    return null;
  }
}

export function getConfiguredSites(env?: Pick<Env, "SITES_CONFIG_JSON">): readonly SiteConfig[] {
  const raw = env?.SITES_CONFIG_JSON?.trim();
  if (raw) {
    const parsed = parseSitesFromSecret(raw);
    if (parsed) return parsed;
  }
  return MY_SITES;
}

export function getAllowedSite(
  env: Pick<Env, "SITES_CONFIG_JSON">,
  siteId: string
): SiteConfig | null {
  return getConfiguredSites(env).find((s) => s.id === siteId) ?? null;
}

/**
 * Extrae el hostname limpio en minúsculas a partir de un host o URL completa.
 */
export function normalizeHost(hostOrUrl: string): string | null {
  const trimmed = hostOrUrl.trim().toLowerCase();
  if (!trimmed || trimmed.length > 255) return null;
  try {
    if (trimmed.includes("://")) {
      return new URL(trimmed).hostname.toLowerCase();
    }
    return trimmed.replace(/:\d+$/, "").replace(/\/.*$/, "");
  } catch {
    return null;
  }
}

export function isAllowedHostForSite(site: SiteConfig, hostOrUrl: string): boolean {
  const host = normalizeHost(hostOrUrl);
  if (!host) return false;
  return site.allowedHosts.some((allowed) => allowed.toLowerCase() === host);
}

/**
 * Relaciona un evento de Cloudflare GraphQL únicamente con un sitio permitido
 * que coincida tanto en `cloudflareZoneId` como en `allowedHosts`.
 */
export function findSiteByZoneAndHost(
  env: Pick<Env, "SITES_CONFIG_JSON">,
  zoneId: string,
  host?: string | null
): SiteConfig | null {
  const matchingZoneSites = getConfiguredSites(env).filter(
    (s) => s.cloudflareZoneId && s.cloudflareZoneId === zoneId
  );
  if (matchingZoneSites.length === 0) return null;

  if (host) {
    const exactMatch = matchingZoneSites.find((s) => isAllowedHostForSite(s, host));
    return exactMatch ?? null;
  }

  return matchingZoneSites.length === 1 ? matchingZoneSites[0] : null;
}

export function getSitesWithCloudflareZone(
  env: Pick<Env, "SITES_CONFIG_JSON">
): SiteConfig[] {
  return getConfiguredSites(env).filter((s) => Boolean(s.cloudflareZoneId?.trim()));
}

export function getSitesWithVercelProject(
  env: Pick<Env, "SITES_CONFIG_JSON">
): SiteConfig[] {
  return getConfiguredSites(env).filter((s) => Boolean(s.vercelProjectId?.trim()));
}
