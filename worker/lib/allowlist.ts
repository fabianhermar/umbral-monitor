import { ALLOWED_SITE_IDS, MY_SITES, type SiteConfig } from "../../config/sites.config";

const SITE_BY_ID = new Map<string, SiteConfig>(MY_SITES.map((s) => [s.id, s]));

export function getConfiguredSites(): readonly SiteConfig[] {
  return MY_SITES;
}

export function getAllowedSite(siteId: string): SiteConfig | null {
  if (!ALLOWED_SITE_IDS.has(siteId)) {
    return null;
  }
  return SITE_BY_ID.get(siteId) ?? null;
}

export function normalizeHost(hostOrUrl: string): string | null {
  const trimmed = hostOrUrl.trim().toLowerCase();
  if (!trimmed) return null;
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

export function findSiteByZoneAndHost(
  zoneId: string,
  host?: string | null
): SiteConfig | null {
  const matchingZoneSites = MY_SITES.filter(
    (s) => s.cloudflareZoneId && s.cloudflareZoneId === zoneId
  );
  if (matchingZoneSites.length === 0) return null;

  if (host) {
    const exactMatch = matchingZoneSites.find((s) => isAllowedHostForSite(s, host));
    if (exactMatch) return exactMatch;
    // Si hay host explícito y NO pertenece a ninguno de nuestros allowedHosts, lo rechazamos.
    return null;
  }

  return matchingZoneSites.length === 1 ? matchingZoneSites[0] : null;
}

export function getSitesWithCloudflareZone(): SiteConfig[] {
  return MY_SITES.filter((s) => Boolean(s.cloudflareZoneId?.trim()));
}

export function getSitesWithVercelProject(): SiteConfig[] {
  return MY_SITES.filter((s) => Boolean(s.vercelProjectId?.trim()));
}
