/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  tests/security/crypto-and-replay.test.ts
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
 * Suite de Seguridad 01 — Criptografía, Secretos y Protección Anti-Replay
 * ============================================================================
 */

import { describe, expect, it } from "vitest";
import {
  getSiteSecret,
  hmacSha256Hex,
  sha256ShortId,
  timingSafeEqualStrings,
} from "../../worker/security/crypto";
import { consumeSignatureOnce } from "../../worker/security/replay-guard";
import type { Env } from "../../worker/types";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as D1Database,
    ...overrides,
  };
}

describe("Criptografía HMAC-SHA256 y comparación en tiempo constante", () => {
  it("genera firmas HMAC-SHA256 deterministas de 64 caracteres hexadecimales", async () => {
    const sig1 = await hmacSha256Hex("secreto_super_seguro_123456", "1700000000.{\"ok\":true}");
    const sig2 = await hmacSha256Hex("secreto_super_seguro_123456", "1700000000.{\"ok\":true}");
    const sigTampered = await hmacSha256Hex("secreto_super_seguro_123456", "1700000001.{\"ok\":true}");

    expect(sig1).toHaveLength(64);
    expect(sig1).toBe(sig2);
    expect(sig1).not.toBe(sigTampered);
  });

  it("compara cadenas de igual o distinta longitud sin excepciones ni falsos positivos", async () => {
    expect(await timingSafeEqualStrings("clave-secreta-exacta", "clave-secreta-exacta")).toBe(true);
    expect(await timingSafeEqualStrings("clave-secreta-exacta", "clave-secreta-exactB")).toBe(false);
    // Longitudes radicalmente distintas (no debe filtrar ni fallar)
    expect(await timingSafeEqualStrings("a", "a".repeat(2048))).toBe(false);
    expect(await timingSafeEqualStrings("", "no-vacio")).toBe(false);
    expect(await timingSafeEqualStrings("soporte-ñ-áéíóú-🔐", "soporte-ñ-áéíóú-🔐")).toBe(true);
  });

  it("genera identificadores cortos deterministas con prefijo", async () => {
    const id = await sha256ShortId("cf", "evento-unico-1");
    expect(id.startsWith("cf_")).toBe(true);
    expect(id.length).toBe(23);
  });
});

describe("Gestión segura de SITE_SECRETS_JSON", () => {
  it("rechaza sitios fuera de allowlist, secretos cortos (<16) y claves de prototipo", () => {
    const env = makeEnv({
      SITE_SECRETS_JSON: JSON.stringify({
        "mi-web-principal": "secreto_valido_mas_de_16_caracteres",
        "mi-app": "corto_123",
      }),
    });

    expect(getSiteSecret(env, "mi-web-principal")).toBe("secreto_valido_mas_de_16_caracteres");
    expect(getSiteSecret(env, "mi-app")).toBeNull(); // Demasiado corto
    expect(getSiteSecret(env, "sitio-ajeno")).toBeNull(); // No está en allowlist
    expect(getSiteSecret(env, "__proto__")).toBeNull();
    expect(getSiteSecret(env, "constructor")).toBeNull();
  });

  it("maneja JSON malformado sin lanzar excepciones", () => {
    const env = makeEnv({ SITE_SECRETS_JSON: "{json-roto" });
    expect(getSiteSecret(env, "mi-web-principal")).toBeNull();
  });
});

describe("Guardia Anti-Replay de firmas HMAC", () => {
  it("permite una firma la primera vez y bloquea cualquier repetición inmediata", () => {
    const uniqueSig = `test-sig-${crypto.randomUUID()}`;
    expect(consumeSignatureOnce(uniqueSig, 60)).toBe(true);
    expect(consumeSignatureOnce(uniqueSig, 60)).toBe(false);
    expect(consumeSignatureOnce(uniqueSig, 60)).toBe(false);
  });

  it("soporta miles de firmas sin desbordar la memoria", () => {
    for (let i = 0; i < 2100; i++) {
      expect(consumeSignatureOnce(`bulk-sig-${i}-${crypto.randomUUID()}`, 1)).toBe(true);
    }
  });
});
