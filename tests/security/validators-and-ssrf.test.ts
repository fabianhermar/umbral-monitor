/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  tests/security/validators-and-ssrf.test.ts
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
 * Suite de Seguridad 02 — Sanitización, Anti-Prototype Pollution y Anti-SSRF
 * ============================================================================
 */

import { describe, expect, it } from "vitest";
import { validatePublicDemoUrl } from "../../worker/demo/demo-probe.service";
import {
  cleanText,
  sanitizeMetadata,
  validateIngestPayload,
} from "../../worker/validators/ingest.validator";

describe("Sanitización de entradas y protección contra Prototype Pollution", () => {
  it("elimina __proto__, constructor y prototype en cualquier nivel", () => {
    const malicious = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"pwned":true}},"safe":"ok","nested":{"__proto__":{"bad":1},"keep":42}}'
    );

    const sanitized = sanitizeMetadata(malicious);
    expect(sanitized.safe).toBe("ok");
    expect((sanitized.nested as Record<string, unknown>).keep).toBe(42);
    expect(Object.prototype.hasOwnProperty.call(sanitized, "__proto__")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(sanitized, "constructor")).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).pwned).toBeUndefined();
  });

  it("elimina caracteres de control ASCII invisibles y recorta longitudes excesivas", () => {
    const dirty = "Hola\x00\x07\x1B Mundo";
    expect(cleanText(dirty, 50)).toBe("Hola Mundo");
    expect(cleanText("x".repeat(500), 20)).toHaveLength(20);
  });

  it("valida estrictamente categorías, severidades y campos requeridos en ingesta", () => {
    expect(validateIngestPayload(null).ok).toBe(false);
    expect(validateIngestPayload([]).ok).toBe(false);
    expect(
      validateIngestPayload({
        category: "sql-injection",
        severity: "high",
        title: "Test",
        description: "Desc",
      }).ok
    ).toBe(false);

    const valid = validateIngestPayload({
      category: "attack",
      severity: "critical",
      title: "  Intento bloqueado\x00 ",
      description: "Detalle del evento",
      method: "post",
      country: "mx",
    });

    expect(valid.ok).toBe(true);
    if (valid.ok) {
      expect(valid.data.title).toBe("Intento bloqueado");
      expect(valid.data.method).toBe("POST");
      expect(valid.data.country).toBe("MX");
    }
  });
});

describe("Protección Anti-SSRF en el Analizador Público (Demo Mode)", () => {
  const maliciousUrls = [
    "http://example.com",                     // Esquema sin cifrar
    "file:///etc/passwd",                     // Esquema local
    "javascript:alert(1)",                    // Esquema script
    "https://localhost/admin",                // Localhost directo
    "https://api.localhost",                  // Subdominio .localhost
    "https://internal-db.local",              // Dominio mDNS .local
    "https://metadata.internal",              // Dominio .internal
    "https://127.0.0.1",                      // Loopback IPv4
    "https://10.0.0.1",                       // Red privada Clase A
    "https://172.16.0.5",                     // Red privada Clase B
    "https://192.168.1.1",                    // Red privada Clase C
    "https://169.254.169.254/latest/meta-data/", // AWS/Cloud Instance Metadata!
    "https://[::1]/",                         // Loopback IPv6
    "https://admin:secret@example.com",       // Credenciales incrustadas
    "https://example.com:8080/api",           // Puerto no estándar
    "https://intranet",                       // Host sin TLD público
  ];

  for (const badUrl of maliciousUrls) {
    it(`bloquea vector SSRF: ${badUrl}`, () => {
      const res = validatePublicDemoUrl(badUrl);
      expect(res.ok).toBe(false);
    });
  }

  it("permite dominios públicos HTTPS legítimos en puerto estándar 443", () => {
    const ok1 = validatePublicDemoUrl("https://example.com");
    const ok2 = validatePublicDemoUrl("cloudflare.com");
    expect(ok1.ok).toBe(true);
    expect(ok2.ok).toBe(true);
  });
});
