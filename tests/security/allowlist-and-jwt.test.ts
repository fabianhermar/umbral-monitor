/**
 * ============================================================================
 * Suite de Seguridad 03 — Lista Blanca y Verificación RS256 Cloudflare Access
 * ============================================================================
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  findSiteByZoneAndHost,
  getAllowedSite,
  getConfiguredSites,
  isAllowedHostForSite,
} from "../../worker/security/allowlist";
import { verifyCloudflareAccessJwt } from "../../worker/security/cf-access-jwt";

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function jsonToBase64Url(obj: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(obj)));
}

describe("Aislamiento de Lista Blanca (Allowlist y SITES_CONFIG_JSON)", () => {
  it("usa SITES_CONFIG_JSON cuando está presente e ignora entradas sin HTTPS", () => {
    const customEnv = {
      SITES_CONFIG_JSON: JSON.stringify([
        {
          id: "privado-1",
          name: "Privado Uno",
          domain: "privado.test",
          allowedHosts: ["privado.test", "www.privado.test"],
          checkUrl: "https://privado.test",
          cloudflareZoneId: "zone_123",
        },
        {
          id: "inseguro-http",
          name: "Inseguro",
          domain: "inseguro.test",
          checkUrl: "http://inseguro.test", // Debe ser descartado por no usar https://
        },
      ]),
    };

    const sites = getConfiguredSites(customEnv);
    expect(sites).toHaveLength(1);
    expect(sites[0].id).toBe("privado-1");

    const site = getAllowedSite(customEnv, "privado-1")!;
    expect(isAllowedHostForSite(site, "https://www.privado.test/login")).toBe(true);
    // Subdominios maliciosos que intentan imitar el dominio legítimo
    expect(isAllowedHostForSite(site, "https://privado.test.atacante.com")).toBe(false);
    expect(isAllowedHostForSite(site, "https://fake-privado.test")).toBe(false);

    expect(findSiteByZoneAndHost(customEnv, "zone_123", "privado.test")?.id).toBe("privado-1");
    expect(findSiteByZoneAndHost(customEnv, "zone_123", "otro-host.com")).toBeNull();
    expect(findSiteByZoneAndHost(customEnv, "zone_ajena", "privado.test")).toBeNull();
  });
});

describe("Verificación Criptográfica RS256 de JWT (Cloudflare Zero Trust Access)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("acepta un JWT RS256 legítimo y rechaza tokens alterados, expirados o con alg=none", async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    );

    const publicJwk = (await crypto.subtle.exportKey("jwk", keyPair.publicKey)) as JsonWebKey & {
      kid?: string;
    };
    publicJwk.kid = "key-test-2026";

    const teamDomain = `test-${crypto.randomUUID().slice(0, 8)}.cloudflareaccess.com`;
    const issuer = `https://${teamDomain}`;
    const aud = "aud_tag_oficial_12345";

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ keys: [publicJwk] }), { status: 200 })
    );

    async function signJwt(header: object, payload: object): Promise<string> {
      const h = jsonToBase64Url(header);
      const p = jsonToBase64Url(payload);
      const sigBuf = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        keyPair.privateKey,
        new TextEncoder().encode(`${h}.${p}`)
      );
      return `${h}.${p}.${toBase64Url(new Uint8Array(sigBuf))}`;
    }

    const now = Math.floor(Date.now() / 1000);

    // 1. Token legítimo -> válido
    const validToken = await signJwt(
      { alg: "RS256", kid: "key-test-2026", typ: "JWT" },
      { iss: issuer, aud: [aud], email: "Admin@MiDominio.com", exp: now + 600 }
    );
    const resValid = await verifyCloudflareAccessJwt(validToken, teamDomain, aud);
    expect(resValid).toEqual({ valid: true, email: "admin@midominio.com" });

    // 2. Ataque de alteración de payload después de firmar -> rechazado
    const parts = validToken.split(".");
    const tamperedPayload = jsonToBase64Url({
      iss: issuer,
      aud: [aud],
      email: "atacante@evil.com",
      exp: now + 600,
    });
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    expect((await verifyCloudflareAccessJwt(tamperedToken, teamDomain, aud)).valid).toBe(false);

    // 3. Ataque de degradación alg: "none" -> rechazado
    const noneToken = `${jsonToBase64Url({ alg: "none", kid: "key-test-2026" })}.${parts[1]}.`;
    expect((await verifyCloudflareAccessJwt(noneToken, teamDomain, aud)).valid).toBe(false);

    // 4. Token expirado -> rechazado
    const expiredToken = await signJwt(
      { alg: "RS256", kid: "key-test-2026" },
      { iss: issuer, aud: [aud], email: "admin@midominio.com", exp: now - 10 }
    );
    expect((await verifyCloudflareAccessJwt(expiredToken, teamDomain, aud)).valid).toBe(false);

    // 5. Audience incorrecto -> rechazado
    expect((await verifyCloudflareAccessJwt(validToken, teamDomain, "otro_aud")).valid).toBe(false);
  });
});
