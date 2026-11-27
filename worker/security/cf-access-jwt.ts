/**
 * ============================================================================
 * Verificación Criptográfica de JWT de Cloudflare Access (Zero Trust)
 * ============================================================================
 * Impide que un atacante falsifique las cabeceras `Cf-Access-*` enviando
 * peticiones directas al Worker: descarga y cachea las claves públicas RSA
 * (JWKS) de tu equipo en Cloudflare Zero Trust y verifica firma RS256,
 * audiencia (`aud`), emisor (`iss`) y expiración (`exp`).
 */

interface JwkKey extends JsonWebKey {
  kid?: string;
}

interface CfCertsResponse {
  keys?: JwkKey[];
}

interface CfJwtPayload {
  email?: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  nbf?: number;
}

let cachedKeys: { issuer: string; expiresAt: number; keys: JwkKey[] } | null = null;

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const binary = atob(padded + "=".repeat(padLen));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJwtPart<T>(part: string): T | null {
  try {
    const bytes = base64UrlToUint8Array(part);
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

async function fetchTeamJwks(issuer: string): Promise<JwkKey[]> {
  if (cachedKeys && cachedKeys.issuer === issuer && Date.now() < cachedKeys.expiresAt) {
    return cachedKeys.keys;
  }

  const res = await fetch(`${issuer}/cdn-cgi/access/certs`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) {
    throw new Error(`No se pudieron obtener certificados JWKS (${res.status})`);
  }

  const data = (await res.json()) as CfCertsResponse;
  const keys = Array.isArray(data.keys) ? data.keys : [];
  cachedKeys = {
    issuer,
    expiresAt: Date.now() + 10 * 60_000, // Cache de 10 minutos
    keys,
  };
  return keys;
}

export async function verifyCloudflareAccessJwt(
  token: string,
  teamDomainRaw: string,
  expectedAudRaw: string
): Promise<{ valid: boolean; email?: string }> {
  const cleanDomain = teamDomainRaw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
  const expectedAud = expectedAudRaw.trim();

  if (!cleanDomain || !expectedAud) {
    return { valid: false };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false };
  }

  const header = decodeJwtPart<{ alg?: string; kid?: string }>(parts[0]);
  const payload = decodeJwtPart<CfJwtPayload>(parts[1]);

  if (!header || !payload || header.alg !== "RS256" || !header.kid) {
    return { valid: false };
  }

  const expectedIssuer = `https://${cleanDomain}`;
  if (payload.iss !== expectedIssuer) {
    return { valid: false };
  }

  const audList = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
  if (!audList.includes(expectedAud)) {
    return { valid: false };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) {
    return { valid: false };
  }
  if (typeof payload.nbf === "number" && payload.nbf > nowSec + 30) {
    return { valid: false };
  }

  try {
    const jwks = await fetchTeamJwks(expectedIssuer);
    const matchingJwk = jwks.find((k) => k.kid === header.kid);
    if (!matchingJwk) {
      return { valid: false };
    }

    const cryptoKey = await crypto.subtle.importKey(
      "jwk",
      matchingJwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signatureBytes = base64UrlToUint8Array(parts[2]);

    const verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      signatureBytes,
      signedData
    );

    if (!verified || !payload.email) {
      return { valid: false };
    }

    return { valid: true, email: payload.email.trim().toLowerCase() };
  } catch {
    return { valid: false };
  }
}
