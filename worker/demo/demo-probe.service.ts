/**
 * ============================================================================
 * Analizador Seguro de Páginas de Prueba (Modo Demo — Anti-SSRF)
 * ============================================================================
 * Permite a un visitante probar en vivo el motor de análisis de UMBRAL
 * (latencia, código HTTP y auditoría de cabeceras `HDR`) sobre una URL pública
 * sin guardar nada en D1 y bloqueando cualquier intento de SSRF hacia redes
 * privadas, IPs directas, localhost o puertos no estándar.
 */

const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const BLOCKED_HOST_SUFFIXES = [
  "localhost",
  ".local",
  ".internal",
  ".localhost",
  ".home",
  ".lan",
  ".corp",
];

export interface DemoProbeResult {
  requestedUrl: string;
  finalUrl: string;
  ok: boolean;
  statusCode: number | null;
  latencyMs: number;
  server: string | null;
  cfRay: string | null;
  securityScore: number;
  presentHeaders: string[];
  missingHeaders: string[];
  downgradedToHttp: boolean;
  error?: string;
}

export function validatePublicDemoUrl(
  rawUrl: string
): { ok: true; url: URL } | { ok: false; error: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 300) {
    return { ok: false, error: "Ingresa una URL HTTPS válida (máx. 300 caracteres)." };
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return { ok: false, error: "Formato de URL inválido." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Por seguridad, solo se permiten URLs públicas con https://." };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "No se permiten credenciales dentro de la URL." };
  }
  if (parsed.port && parsed.port !== "443") {
    return { ok: false, error: "Solo se permite el puerto HTTPS estándar (443)." };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host.includes(".") || host.includes(":") || IPV4_REGEX.test(host)) {
    return { ok: false, error: "Usa un dominio público válido (no se permiten IPs directas)." };
  }
  if (BLOCKED_HOST_SUFFIXES.some((s) => host === s || host.endsWith(s))) {
    return { ok: false, error: "Dominio interno/local bloqueado por protección anti-SSRF." };
  }

  return { ok: true, url: parsed };
}

export async function runLiveDemoProbe(rawUrl: string): Promise<DemoProbeResult> {
  const validated = validatePublicDemoUrl(rawUrl);
  if (!validated.ok) {
    return {
      requestedUrl: rawUrl,
      finalUrl: rawUrl,
      ok: false,
      statusCode: null,
      latencyMs: 0,
      server: null,
      cfRay: null,
      securityScore: 0,
      presentHeaders: [],
      missingHeaders: [],
      downgradedToHttp: false,
      error: validated.error,
    };
  }

  const targetUrl = validated.url.toString();
  const started = Date.now();

  try {
    const res = await fetch(targetUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(6000),
    });

    const latencyMs = Date.now() - started;
    const finalUrl = res.url || targetUrl;
    const downgradedToHttp = finalUrl.startsWith("http://");

    const presentHeaders: string[] = [];
    const missingHeaders: string[] = [];

    const hasHsts = !downgradedToHttp && Boolean(res.headers.get("strict-transport-security"));
    (hasHsts ? presentHeaders : missingHeaders).push("strict-transport-security");

    const hasXcto = Boolean(res.headers.get("x-content-type-options"));
    (hasXcto ? presentHeaders : missingHeaders).push("x-content-type-options");

    const csp = res.headers.get("content-security-policy");
    (csp ? presentHeaders : missingHeaders).push("content-security-policy");

    const hasFrame =
      Boolean(res.headers.get("x-frame-options")) ||
      Boolean(csp && csp.toLowerCase().includes("frame-ancestors"));
    (hasFrame ? presentHeaders : missingHeaders).push("x-frame-options");

    const securityScore = Math.max(0, 100 - missingHeaders.length * 25);
    const server = res.headers.get("server");
    const cfRay = res.headers.get("cf-ray");

    await res.body?.cancel();

    return {
      requestedUrl: targetUrl,
      finalUrl,
      ok: res.status >= 200 && res.status < 400 && !downgradedToHttp,
      statusCode: res.status,
      latencyMs,
      server,
      cfRay,
      securityScore,
      presentHeaders,
      missingHeaders,
      downgradedToHttp,
    };
  } catch (err) {
    return {
      requestedUrl: targetUrl,
      finalUrl: targetUrl,
      ok: false,
      statusCode: null,
      latencyMs: Date.now() - started,
      server: null,
      cfRay: null,
      securityScore: 0,
      presentHeaders: [],
      missingHeaders: [],
      downgradedToHttp: false,
      error: err instanceof Error ? err.message : "No se pudo conectar con la URL de prueba.",
    };
  }
}
