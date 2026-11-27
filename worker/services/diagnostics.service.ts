/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  worker/services/diagnostics.service.ts
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
 * Servicio de Diagnóstico Profundo por Dominio (DNS + HTTP->HTTPS + Cabeceras)
 * ============================================================================
 * Ejecuta una auditoría técnica completa bajo demanda para uno de tus dominios:
 *  1. Consulta DNS-over-HTTPS (Cloudflare 1.1.1.1) para registros A, AAAA, CAA y TXT.
 *  2. Verifica si `http://<dominio>` fuerza redirección segura a `https://`.
 *  3. Evalúa 7 cabeceras defensivas HTTP extendidas.
 *  4. Comprueba si existe `/.well-known/security.txt`.
 */

import type { SiteConfig } from "../../config/sites.config";

interface DnsJsonAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DnsJsonResponse {
  Answer?: DnsJsonAnswer[];
}

export interface SiteDeepDiagnostics {
  siteId: string;
  domain: string;
  checkedAt: string;
  httpToHttpsRedirect: {
    enforced: boolean;
    statusCode: number | null;
    location: string | null;
  };
  httpsProbe: {
    ok: boolean;
    finalUrl: string;
    statusCode: number | null;
    latencyMs: number;
    server: string | null;
    cfRay: string | null;
    error?: string;
  };
  headersAudit: {
    score: number;
    headers: Array<{ name: string; present: boolean; valuePreview: string | null }>;
  };
  dns: {
    aRecords: string[];
    aaaaRecords: string[];
    caaRecords: string[];
    hasSpfOrDmarc: boolean;
  };
  hasSecurityTxt: boolean;
}

const EXTENDED_HEADERS = [
  "strict-transport-security",
  "content-security-policy",
  "x-content-type-options",
  "x-frame-options",
  "referrer-policy",
  "permissions-policy",
  "cross-origin-opener-policy",
] as const;

async function queryDnsDoH(domain: string, type: "A" | "AAAA" | "CAA" | "TXT"): Promise<string[]> {
  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`;
    const res = await fetch(url, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as DnsJsonResponse;
    return (data.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, "")).slice(0, 8);
  } catch {
    return [];
  }
}

export async function runSiteDeepDiagnostics(site: SiteConfig): Promise<SiteDeepDiagnostics> {
  const checkedAt = new Date().toISOString();

  // Lanzar consultas DNS, prueba HTTP->HTTPS, sonda HTTPS y security.txt en paralelo
  const [aRecords, aaaaRecords, caaRecords, txtRecords, dmarcRecords, httpRes, httpsRes, secTxtRes] =
    await Promise.all([
      queryDnsDoH(site.domain, "A"),
      queryDnsDoH(site.domain, "AAAA"),
      queryDnsDoH(site.domain, "CAA"),
      queryDnsDoH(site.domain, "TXT"),
      queryDnsDoH(`_dmarc.${site.domain}`, "TXT"),
      fetch(`http://${site.domain}`, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      }).catch(() => null),
      (async () => {
        const start = Date.now();
        try {
          const r = await fetch(site.checkUrl, {
            method: "GET",
            redirect: "follow",
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            },
            signal: AbortSignal.timeout(7000),
          });
          return { response: r, latencyMs: Date.now() - start, error: undefined };
        } catch (err) {
          return {
            response: null,
            latencyMs: Date.now() - start,
            error: err instanceof Error ? err.message : "Error de conexión HTTPS",
          };
        }
      })(),
      fetch(`https://${site.domain}/.well-known/security.txt`, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(4000),
      }).catch(() => null),
    ]);

  // 1. Evaluar redirección HTTP -> HTTPS
  const httpLoc = httpRes?.headers.get("location") ?? null;
  const httpEnforced = Boolean(
    httpRes &&
      httpRes.status >= 300 &&
      httpRes.status < 400 &&
      httpLoc &&
      httpLoc.toLowerCase().startsWith("https://")
  );
  await httpRes?.body?.cancel();

  // 2. Evaluar respuesta HTTPS y las 7 cabeceras extendidas
  const resp = httpsRes.response;
  const auditedHeaders = EXTENDED_HEADERS.map((name) => {
    const rawVal = resp?.headers.get(name) ?? null;
    // X-Frame-Options también se considera cubierto si CSP define frame-ancestors
    if (name === "x-frame-options" && !rawVal) {
      const csp = resp?.headers.get("content-security-policy") ?? "";
      if (csp.toLowerCase().includes("frame-ancestors")) {
        return { name, present: true, valuePreview: "Cubierto vía CSP frame-ancestors" };
      }
    }
    return {
      name,
      present: Boolean(rawVal),
      valuePreview: rawVal ? rawVal.slice(0, 90) : null,
    };
  });

  const presentCount = auditedHeaders.filter((h) => h.present).length;
  const headersScore = resp ? Math.round((presentCount / EXTENDED_HEADERS.length) * 100) : 0;

  const httpsProbe = {
    ok: Boolean(resp && resp.status >= 200 && resp.status < 400),
    finalUrl: resp?.url || site.checkUrl,
    statusCode: resp?.status ?? null,
    latencyMs: httpsRes.latencyMs,
    server: resp?.headers.get("server") ?? null,
    cfRay: resp?.headers.get("cf-ray") ?? null,
    error: httpsRes.error,
  };
  await resp?.body?.cancel();

  // 3. Evaluar security.txt (debe devolver 200 y contener Contact:)
  let hasSecurityTxt = false;
  if (secTxtRes && secTxtRes.status === 200) {
    const text = await secTxtRes.text().catch(() => "");
    hasSecurityTxt = /contact:/i.test(text);
  } else {
    await secTxtRes?.body?.cancel();
  }

  const hasSpfOrDmarc =
    txtRecords.some((t) => t.toLowerCase().includes("v=spf1")) ||
    dmarcRecords.some((t) => t.toLowerCase().includes("v=dmarc1"));

  return {
    siteId: site.id,
    domain: site.domain,
    checkedAt,
    httpToHttpsRedirect: {
      enforced: httpEnforced,
      statusCode: httpRes?.status ?? null,
      location: httpLoc,
    },
    httpsProbe,
    headersAudit: {
      score: headersScore,
      headers: auditedHeaders,
    },
    dns: {
      aRecords,
      aaaaRecords,
      caaRecords,
      hasSpfOrDmarc,
    },
    hasSecurityTxt,
  };
}
