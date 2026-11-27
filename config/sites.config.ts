/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  config/sites.config.ts
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
 * UMBRAL — LISTA BLANCA ESTRICTA DE TUS PROPIAS PÁGINAS WEB
 * ============================================================================
 * Este observatorio SOLO monitorea, consulta y acepta telemetría de los sitios
 * configurados por el propietario.
 *
 * Dos formas de configurar tus sitios:
 *  1. Privado (recomendado si subes el repo a GitHub): define `SITES_CONFIG_JSON`
 *     en `.dev.vars` (local) y con `pnpx wrangler secret put SITES_CONFIG_JSON`
 *     en Cloudflare. Eso sobrescribe esta plantilla sin exponer tus dominios.
 *  2. Directo en código (si tu repositorio es privado): edita `MY_SITES` aquí.
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
    id: "mi-web-principal",
    name: "Web Principal",
    domain: "ejemplo.com",
    allowedHosts: ["ejemplo.com", "www.ejemplo.com"],
    checkUrl: "https://ejemplo.com",
    expectedStatus: [200, 204, 301, 302, 307, 308],
    latencyWarnMs: 2500,
    cloudflareZoneId: "", // Cloudflare -> Overview -> Zone ID
    vercelProjectId: "",  // Vercel -> Project Settings -> General -> Project ID
    checkSecurityHeaders: true,
    attackAlertThreshold5m: 15,
  },
  {
    id: "mi-app",
    name: "App / Portal",
    domain: "app.ejemplo.com",
    allowedHosts: ["app.ejemplo.com"],
    checkUrl: "https://app.ejemplo.com",
    expectedStatus: [200, 204, 301, 302, 307, 308],
    latencyWarnMs: 2500,
    cloudflareZoneId: "",
    vercelProjectId: "",
    checkSecurityHeaders: true,
    attackAlertThreshold5m: 15,
  },
] as const;

export const ALLOWED_SITE_IDS = new Set<string>(MY_SITES.map((s) => s.id));
