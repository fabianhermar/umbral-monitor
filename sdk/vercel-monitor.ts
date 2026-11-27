/**
 * ============================================================================
 * SDK Ligero de Telemetría para tus proyectos alojados en Vercel (Free / Pro)
 * ============================================================================
 * Copia este archivo dentro de tus proyectos en Vercel (ej. `lib/vercel-monitor.ts`).
 * No tiene dependencias externas y usa Web Crypto API (compatible con Vercel Edge y Node 18+).
 *
 * Variables de entorno necesarias en cada proyecto de Vercel:
 *   MONITOR_INGEST_URL = https://tu-dashboard.tudominio.com/api/ingest
 *   MONITOR_SITE_ID    = mi-web-principal        (debe existir en config/sites.config.ts)
 *   MONITOR_SITE_SECRET= <secreto_exclusivo_de_este_sitio>
 */

export type MonitorCategory =
  | "downtime"
  | "attack"
  | "block"
  | "security"
  | "error"
  | "deployment";

export type MonitorSeverity = "low" | "medium" | "high" | "critical";

export interface ReportIncidentOptions {
  category: MonitorCategory;
  severity: MonitorSeverity;
  title: string;
  description: string;
  fingerprint?: string;
  host?: string;
  path?: string;
  method?: string;
  clientIp?: string;
  country?: string;
  userAgent?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

const encoder = new TextEncoder();

async function signPayload(secret: string, timestamp: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${rawBody}`));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readEnv(name: string): string | undefined {
  // Compatible con Node.js y entornos Edge de Vercel
  const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return p?.env?.[name];
}

export async function reportIncident(options: ReportIncidentOptions): Promise<boolean> {
  const ingestUrl = readEnv("MONITOR_INGEST_URL");
  const siteId = readEnv("MONITOR_SITE_ID");
  const secret = readEnv("MONITOR_SITE_SECRET");

  if (!ingestUrl || !siteId || !secret) {
    return false;
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const rawBody = JSON.stringify(options);
  const signature = await signPayload(secret, timestamp, rawBody);

  try {
    const res = await fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-site-id": siteId,
        "x-timestamp": timestamp,
        "x-signature": signature,
      },
      body: rawBody,
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Helper para reportar errores 500 o excepciones no controladas en API Routes / Route Handlers.
 */
export async function reportAppError(
  error: unknown,
  req?: Request,
  extra?: Record<string, unknown>
): Promise<boolean> {
  const errMsg = error instanceof Error ? error.message : String(error);
  const url = req ? new URL(req.url) : null;

  return reportIncident({
    category: "error",
    severity: "high",
    title: `Error interno en ${url?.pathname ?? "servidor"}`,
    description: errMsg.slice(0, 500),
    fingerprint: `app-500:${url?.pathname ?? "unknown"}:${errMsg.slice(0, 40)}`,
    host: url?.hostname,
    path: url?.pathname,
    method: req?.method,
    clientIp:
      req?.headers.get("cf-connecting-ip") ??
      req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      undefined,
    country: req?.headers.get("cf-ipcountry") ?? undefined,
    userAgent: req?.headers.get("user-agent") ?? undefined,
    metadata: {
      stack: error instanceof Error ? error.stack?.slice(0, 600) : undefined,
      ...extra,
    },
  });
}

/**
 * Helper para reportar bloqueos o actividad sospechosa (ej. fuerza bruta en login, rate limit, payload malicioso).
 */
export async function reportSecurityBlock(
  req: Request,
  reason: string,
  severity: MonitorSeverity = "high",
  extra?: Record<string, unknown>
): Promise<boolean> {
  const url = new URL(req.url);
  const clientIp =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  return reportIncident({
    category: "block",
    severity,
    title: `Bloqueo de seguridad en ${url.pathname}`,
    description: reason,
    fingerprint: `app-block:${url.pathname}:${clientIp}`,
    host: url.hostname,
    path: url.pathname,
    method: req.method,
    clientIp,
    country: req.headers.get("cf-ipcountry") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
    action: "rate_limit",
    metadata: extra,
  });
}
