/**
 * ============================================================================
 * UMBRAL — LISTA BLANCA ESTRICTA DE TUS PROPIAS PÁGINAS WEB
 * ============================================================================
 * Este observatorio SOLO monitorea, consulta y acepta telemetría de los
 * 5 dominios declarados explícitamente aquí. No existe ningún endpoint
 * público para añadir sitios externos.
 *
 * Para completar la sincronización con Cloudflare WAF y Vercel Deployments:
 * - cloudflareZoneId: Panel de Cloudflare -> tu dominio -> Overview -> Zone ID
 * - vercelProjectId:  Vercel -> Project Settings -> General -> Project ID
 */

export interface SiteConfig {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
  readonly allowedHosts: readonly string[];
  readonly checkUrl: string;
  readonly expectedStatus?: readonly number[];
  readonly latencyWarnMs: number;
  readonly cloudflareZoneId?: string;
  readonly vercelProjectId?: string;
  readonly vercelTeamId?: string;
  readonly checkSecurityHeaders?: boolean;
  readonly attackAlertThreshold5m: number;
}

export const MY_SITES: readonly SiteConfig[] = [
  {
    id: "boxode",
    name: "Boxode",
    domain: "boxode.org",
    allowedHosts: ["boxode.org", "www.boxode.org"],
    checkUrl: "https://www.boxode.org",
    expectedStatus: [200, 204, 301, 302, 307, 308],
    latencyWarnMs: 2500,
    cloudflareZoneId: "", // Pega aquí el Zone ID de boxode.org
    vercelProjectId: "",  // Pega aquí el Project ID de Vercel
    checkSecurityHeaders: true,
    attackAlertThreshold5m: 15,
  },
  {
    id: "carniceriasnmiguel",
    name: "Carnicería San Miguel",
    domain: "carniceriasnmiguel.com",
    allowedHosts: ["carniceriasnmiguel.com", "www.carniceriasnmiguel.com"],
    checkUrl: "https://www.carniceriasnmiguel.com",
    expectedStatus: [200, 204, 301, 302, 307, 308],
    latencyWarnMs: 2500,
    cloudflareZoneId: "", // Pega aquí el Zone ID de carniceriasnmiguel.com
    vercelProjectId: "",
    checkSecurityHeaders: true,
    attackAlertThreshold5m: 15,
  },
  {
    id: "ccut",
    name: "CCUT",
    domain: "ccut.app",
    allowedHosts: ["ccut.app", "www.ccut.app"],
    checkUrl: "https://ccut.app",
    expectedStatus: [200, 204, 301, 302, 307, 308],
    latencyWarnMs: 2500,
    cloudflareZoneId: "", // Pega aquí el Zone ID de ccut.app
    vercelProjectId: "",
    checkSecurityHeaders: true,
    attackAlertThreshold5m: 15,
  },
  {
    id: "duneui",
    name: "Dune UI",
    domain: "duneui.dev",
    allowedHosts: ["duneui.dev", "www.duneui.dev"],
    checkUrl: "https://www.duneui.dev",
    expectedStatus: [200, 204, 301, 302, 307, 308],
    latencyWarnMs: 2500,
    cloudflareZoneId: "", // Pega aquí el Zone ID de duneui.dev
    vercelProjectId: "",
    checkSecurityHeaders: true,
    attackAlertThreshold5m: 15,
  },
  {
    id: "fabianh",
    name: "FabianH",
    domain: "fabianh.me",
    allowedHosts: ["fabianh.me", "www.fabianh.me"],
    checkUrl: "https://fabianh.me",
    expectedStatus: [200, 204, 301, 302, 307, 308],
    latencyWarnMs: 2500,
    cloudflareZoneId: "", // Pega aquí el Zone ID de fabianh.me
    vercelProjectId: "",
    checkSecurityHeaders: true,
    attackAlertThreshold5m: 15,
  },
] as const;

export const ALLOWED_SITE_IDS = new Set<string>(MY_SITES.map((s) => s.id));
