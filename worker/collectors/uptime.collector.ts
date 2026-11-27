/**
 * ============================================================================
 * Recolector Automático — Disponibilidad, Latencia y Cabeceras (Cada 1 min)
 * ============================================================================
 * Revisa cada dominio de `config/sites.config.ts`:
 *  1. Verifica que la URL configurada sea estrictamente HTTPS.
 *  2. Sigue redirecciones legítimas (ej. 308 de Vercel) y detecta si hubo
 *     degradación insegura de HTTPS a HTTP.
 *  3. Audita las 4 cabeceras defensivas (`HDR`).
 *  4. Aplica histéresis de 2 fallos consecutivos antes de declarar caída crítica.
 */

import type { SiteConfig } from "../../config/sites.config";
import { CF_ORIGIN_ERROR_CODES, SECURITY_LIMITS } from "../constants/security";
import {
  getSiteRuntimeState,
  insertUptimeCheck,
  upsertSiteUptimeState,
} from "../repositories/uptime.repo";
import { getConfiguredSites } from "../security/allowlist";
import {
  resolveIncidentByFingerprint,
  upsertIncident,
} from "../services/incidents.service";
import type { Env, SiteOperationalStatus } from "../types";

interface HeaderAuditResult {
  score: number;
  missing: string[];
}

function auditSecurityHeaders(headers: Headers, downgradedToHttp: boolean): HeaderAuditResult {
  const missing: string[] = [];
  if (downgradedToHttp || !headers.get("strict-transport-security")) {
    missing.push("strict-transport-security");
  }
  if (!headers.get("x-content-type-options")) {
    missing.push("x-content-type-options");
  }
  const csp = headers.get("content-security-policy");
  if (!csp) {
    missing.push("content-security-policy");
  }
  const hasFrameProtection =
    Boolean(headers.get("x-frame-options")) ||
    Boolean(csp && csp.toLowerCase().includes("frame-ancestors"));
  if (!hasFrameProtection) {
    missing.push("x-frame-options");
  }

  return {
    score: Math.max(0, 100 - missing.length * 25),
    missing,
  };
}

async function checkSingleSite(env: Env, site: SiteConfig) {
  const checkedAt = new Date().toISOString();
  const started = Date.now();

  let ok = false;
  let statusCode: number | null = null;
  let errorMessage: string | null = null;
  let cfRay: string | null = null;
  let headerAudit: HeaderAuditResult = { score: 100, missing: [] };

  try {
    if (!site.checkUrl.startsWith("https://")) {
      throw new Error("La URL de monitoreo debe usar HTTPS obligatoriamente.");
    }

    const response = await fetch(site.checkUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-MX,es;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(SECURITY_LIMITS.UPTIME_TIMEOUT_MS),
    });

    statusCode = response.status;
    cfRay = response.headers.get("cf-ray");
    const expected = site.expectedStatus ?? [200, 204, 301, 302, 307, 308];
    const downgradedToHttp = Boolean(response.url && response.url.startsWith("http://"));
    ok = expected.includes(response.status) && !downgradedToHttp;

    if (!ok) {
      if (downgradedToHttp) {
        errorMessage = "Redirección insegura detectada hacia HTTP sin cifrar";
      } else if (CF_ORIGIN_ERROR_CODES.has(response.status)) {
        errorMessage = `Error de origen Cloudflare (${response.status}) al conectar con Vercel`;
      } else if (response.status >= 500) {
        errorMessage = `Error interno del servidor (${response.status})`;
      } else if (response.status === 403 || response.status === 429) {
        errorMessage = `Petición bloqueada o limitada (${response.status})`;
      } else {
        errorMessage = `Estado HTTP inesperado: ${response.status}`;
      }
    }

    if (site.checkSecurityHeaders !== false && ok && response.status < 300) {
      headerAudit = auditSecurityHeaders(response.headers, downgradedToHttp);
    }

    await response.body?.cancel();
  } catch (err) {
    ok = false;
    errorMessage = err instanceof Error ? err.message : "Error de red / timeout";
  }

  const latencyMs = Date.now() - started;

  await insertUptimeCheck(env.DB, {
    siteId: site.id,
    checkedAt,
    ok,
    statusCode,
    latencyMs,
    errorMessage,
    cfRay,
    securityScore: headerAudit.score,
    missingHeadersJson: JSON.stringify(headerAudit.missing),
  });

  const state = await getSiteRuntimeState(env.DB, site.id);
  const prevFailures = state?.consecutive_failures ?? 0;
  const nextFailures = ok ? 0 : prevFailures + 1;

  let nextStatus: SiteOperationalStatus = "up";
  if (!ok) {
    nextStatus = nextFailures >= 2 ? "down" : "degraded";
  } else if (latencyMs > site.latencyWarnMs) {
    nextStatus = "degraded";
  }

  await upsertSiteUptimeState(env.DB, site.id, nextFailures, nextStatus, checkedAt);

  // 1. Caídas confirmadas (histéresis de 2 fallos consecutivos)
  const downtimeFp = `downtime:${site.id}`;
  if (!ok && nextFailures >= 2) {
    const isCfOrigin = statusCode !== null && CF_ORIGIN_ERROR_CODES.has(statusCode);
    await upsertIncident(env, {
      siteId: site.id,
      fingerprint: downtimeFp,
      category: statusCode === 403 || statusCode === 429 ? "block" : "downtime",
      severity: "critical",
      source: "uptime-probe",
      title: isCfOrigin
        ? `Caída de origen Cloudflare (${statusCode}) en ${site.name}`
        : `Sitio caído: ${site.name} (${statusCode ?? "sin respuesta"})`,
      description:
        errorMessage ??
        `Fallaron ${nextFailures} chequeos consecutivos contra ${site.checkUrl}.`,
      metadata: {
        checkUrl: site.checkUrl,
        statusCode,
        latencyMs,
        consecutiveFailures: nextFailures,
        cfRay,
      },
    });
  } else if (ok) {
    await resolveIncidentByFingerprint(
      env,
      site.id,
      downtimeFp,
      `Respondió HTTP ${statusCode} en ${latencyMs} ms.`
    );
  }

  // 2. Latencia elevada
  const latencyFp = `latency:${site.id}`;
  if (ok && latencyMs > site.latencyWarnMs) {
    await upsertIncident(env, {
      siteId: site.id,
      fingerprint: latencyFp,
      category: "downtime",
      severity: "medium",
      source: "uptime-probe",
      title: `Latencia elevada en ${site.name} (${latencyMs} ms)`,
      description: `El tiempo de respuesta superó el umbral de ${site.latencyWarnMs} ms.`,
      metadata: { latencyMs, thresholdMs: site.latencyWarnMs, statusCode, cfRay },
    });
  } else if (ok && latencyMs <= site.latencyWarnMs) {
    await resolveIncidentByFingerprint(
      env,
      site.id,
      latencyFp,
      `Latencia normalizada (${latencyMs} ms).`
    );
  }

  // 3. Cabeceras de seguridad HTTP (`HDR`)
  if (site.checkSecurityHeaders !== false && ok && statusCode !== null && statusCode < 300) {
    const headerFp = `sec-headers:${site.id}`;
    if (headerAudit.missing.length > 0) {
      await upsertIncident(env, {
        siteId: site.id,
        fingerprint: headerFp,
        category: "security",
        severity: "low",
        source: "uptime-probe",
        title: `Cabeceras de seguridad faltantes en ${site.name}`,
        description: `Faltan: ${headerAudit.missing.join(", ")} (puntuación ${headerAudit.score}/100).`,
        metadata: {
          missingHeaders: headerAudit.missing,
          securityScore: headerAudit.score,
        },
      });
    } else {
      await resolveIncidentByFingerprint(
        env,
        site.id,
        headerFp,
        "Todas las cabeceras de seguridad verificadas están presentes (100/100)."
      );
    }
  }

  return {
    siteId: site.id,
    ok,
    statusCode,
    latencyMs,
    status: nextStatus,
  };
}

export async function runUptimeChecks(env: Env) {
  const sites = getConfiguredSites(env);
  const settled = await Promise.allSettled(sites.map((site) => checkSingleSite(env, site)));
  return settled.map((r, idx) =>
    r.status === "fulfilled"
      ? r.value
      : {
          siteId: sites[idx].id,
          ok: false,
          statusCode: null,
          latencyMs: 0,
          status: "unknown" as const,
        }
  );
}
