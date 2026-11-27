/**
 * ============================================================================
 * UMBRAL — SDK Ligero de Telemetría para tus proyectos en Vercel (Free / Pro)
 * ============================================================================
 * Copia este archivo dentro de tus proyectos en Vercel (ej. `src/lib/vercel-monitor.ts`).
 * Cero dependencias externas; usa Web Crypto API (compatible con Edge y Node 18+).
 *
 * Variables de entorno necesarias en cada proyecto de Vercel:
 *   MONITOR_INGEST_URL  = https://umbral.tudominio.com/api/ingest
 *   MONITOR_SITE_ID     = mi-web-principal        (debe existir en config/sites.config.ts o SITES_CONFIG_JSON)
 *   MONITOR_SITE_SECRET = <secreto_exclusivo_de_este_sitio>
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
  const p = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return p?.env?.[name];
}

/** Parsea `req.url` de forma segura aunque sea una ruta relativa (`/api/...`) */
function safeParseRequestUrl(req?: Request): { hostname?: string; pathname: string } {
  if (!req?.url) return { pathname: "/" };
  try {
    const parsed = new URL(req.url);
    return { hostname: parsed.hostname, pathname: parsed.pathname };
  } catch {
    try {
      const fallbackHost = req.headers?.get("host") ?? "localhost";
      const parsed = new URL(req.url, `https://${fallbackHost}`);
      return {
        hostname: req.headers?.get("host") ? parsed.hostname : undefined,
        pathname: parsed.pathname,
      };
    } catch {
      return { pathname: "/" };
    }
  }
}

export async function reportIncident(options: ReportIncidentOptions): Promise<boolean> {
  const ingestUrl = readEnv("MONITOR_INGEST_URL");
  const siteId = readEnv("MONITOR_SITE_ID");
  const secret = readEnv("MONITOR_SITE_SECRET");

  if (!ingestUrl || !siteId || !secret) {
    return false;
  }

  try {
    const timestamp = String(Math.floor(Date.now() / 1000));
    // Incluir nonce único evita falsos positivos de replay si ocurren 2 eventos idénticos el mismo segundo
    const payloadWithNonce = {
      ...options,
      metadata: {
        ...(options.metadata ?? {}),
        _nonce: crypto.randomUUID().slice(0, 12),
      },
    };
    const rawBody = JSON.stringify(payloadWithNonce);
    const signature = await signPayload(secret, timestamp, rawBody);

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
 * Reporta errores 500 o excepciones no controladas en API Routes / Route Handlers.
 */
export async function reportAppError(
  error: unknown,
  req?: Request,
  extra?: Record<string, unknown>
): Promise<boolean> {
  const errMsg = error instanceof Error ? error.message : String(error);
  const { hostname, pathname } = safeParseRequestUrl(req);

  return reportIncident({
    category: "error",
    severity: "high",
    title: `Error interno en ${pathname}`,
    description: errMsg.slice(0, 500),
    fingerprint: `app-500:${pathname}:${errMsg.slice(0, 40)}`,
    host: hostname,
    path: pathname,
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
 * Reporta bloqueos o actividad sospechosa (fuerza bruta en login, rate limit, payload malicioso).
 */
export async function reportSecurityBlock(
  req: Request,
  reason: string,
  severity: MonitorSeverity = "high",
  extra?: Record<string, unknown>
): Promise<boolean> {
  const { hostname, pathname } = safeParseRequestUrl(req);
  const clientIp =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  return reportIncident({
    category: "block",
    severity,
    title: `Bloqueo de seguridad en ${pathname}`,
    description: reason,
    fingerprint: `app-block:${pathname}:${clientIp}`,
    host: hostname,
    path: pathname,
    method: req.method,
    clientIp,
    country: req.headers.get("cf-ipcountry") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
    action: "rate_limit",
    metadata: extra,
  });
}
