/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  tests/integration/worker-api.test.ts
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
 * Suite de Integración 05 — Worker HTTP, Auth, Rate-Limiting, SDK y Demo Mode
 * ============================================================================
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { reportAppError, reportSecurityBlock } from "../../sdk/vercel-monitor";
import worker from "../../worker/index";
import type { Env } from "../../worker/types";

const mockExecutionCtx = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
  props: {},
} as unknown as ExecutionContext;

/** Simulador ligero de D1 en memoria para pruebas unitarias/integración rápidas */
function createMockD1(): D1Database {
  const stmt = {
    bind() {
      return stmt;
    },
    async first() {
      return null;
    },
    async all() {
      return { results: [], success: true, meta: {} };
    },
    async run() {
      return { success: true, meta: { changes: 1 } };
    },
  };
  return {
    prepare: () => stmt,
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    withSession: () => ({}) as D1DatabaseSession,
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}

function makeProdEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: createMockD1(),
    ENVIRONMENT: "production",
    DASHBOARD_ADMIN_EMAIL: "owner@ejemplo.com",
    DASHBOARD_API_KEY: "clave_maestra_produccion_super_larga_2026!",
    SITE_SECRETS_JSON: JSON.stringify({
      "mi-web-principal": "secreto_exclusivo_de_32_caracteres_ok",
    }),
    ...overrides,
  };
}

describe("Worker API — Cabeceras Defensivas, Autenticación y Fuerza Bruta", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aplica todas las cabeceras de seguridad HTTP (CSP, HSTS, XFO, XCTO, COOP) en /api/health", async () => {
    const res = await worker.fetch(
      new Request("https://umbral.ejemplo.com/api/health"),
      makeProdEnv(),
      mockExecutionCtx
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=31536000");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("impide suplantación de cabeceras Cf-Access-* en producción sin JWT RS256 válido", async () => {
    const spoofReq = new Request("https://umbral.ejemplo.com/api/dashboard/overview", {
      headers: {
        "Cf-Access-Authenticated-User-Email": "owner@ejemplo.com",
        "Cf-Access-Jwt-Assertion": "eyJhbGciOiJub25lIn0.eyJlbWFpbCI6Im93bmVyQGVqZW1wbG8uY29tIn0.",
      },
    });

    const res = await worker.fetch(spoofReq, makeProdEnv(), mockExecutionCtx);
    expect(res.status).toBe(401);
  });

  it("permite acceso con X-Dashboard-Key válida y bloquea fuerza bruta con HTTP 429", async () => {
    const env = makeProdEnv();

    // Clave correcta -> 200 OK
    const okRes = await worker.fetch(
      new Request("https://umbral.ejemplo.com/api/dashboard/overview", {
        headers: { "X-Dashboard-Key": env.DASHBOARD_API_KEY! },
      }),
      env,
      mockExecutionCtx
    );
    expect(okRes.status).toBe(200);

    // 16 intentos fallidos desde la misma IP -> debe activar 429 Too Many Requests
    let lastStatus = 0;
    const attackerIp = "198.51.100.250";
    for (let i = 0; i < 16; i++) {
      const badRes = await worker.fetch(
        new Request("https://umbral.ejemplo.com/api/dashboard/overview", {
          headers: {
            "cf-connecting-ip": attackerIp,
            "X-Dashboard-Key": `intento-falso-${i}`,
          },
        }),
        env,
        mockExecutionCtx
      );
      lastStatus = badRes.status;
    }
    expect(lastStatus).toBe(429);
  });
});

describe("Integración de punta a punta: SDK Vercel -> Worker /api/ingest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.MONITOR_INGEST_URL;
    delete process.env.MONITOR_SITE_ID;
    delete process.env.MONITOR_SITE_SECRET;
  });

  it("acepta eventos firmados por sdk/vercel-monitor.ts incluso con req.url relativa", async () => {
    const env = makeProdEnv();
    process.env.MONITOR_INGEST_URL = "https://umbral.ejemplo.com/api/ingest";
    process.env.MONITOR_SITE_ID = "mi-web-principal";
    process.env.MONITOR_SITE_SECRET = "secreto_exclusivo_de_32_caracteres_ok";

    // Redirigir el fetch saliente del SDK directamente al Worker en memoria
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const req = new Request(input as string, init);
      return worker.fetch(req, env, mockExecutionCtx);
    });

    const fakeVercelReq = new Request("https://ejemplo.com/api/checkout", {
      method: "POST",
      headers: {
        "cf-connecting-ip": "203.0.113.10",
        "cf-ipcountry": "MX",
      },
    });

    const okError = await reportAppError(new Error("Fallo de conexión DB"), fakeVercelReq);
    expect(okError).toBe(true);

    const okBlock = await reportSecurityBlock(fakeVercelReq, "Exceso de intentos", "high");
    expect(okBlock).toBe(true);
  });
});

describe("Aislamiento total del Modo Demo (DEMO_MODE=true)", () => {
  it("desactiva /api/ingest con 403 y aplica rate-limit en /demo/probe", async () => {
    const demoEnv = makeProdEnv({ DEMO_MODE: "true" });

    const ingestRes = await worker.fetch(
      new Request("https://demo.ejemplo.com/api/ingest", { method: "POST" }),
      demoEnv,
      mockExecutionCtx
    );
    expect(ingestRes.status).toBe(403);

    // 6 sondas seguidas desde la misma IP -> la 6ta debe recibir HTTP 429
    const probeIp = "203.0.113.200";
    let sixthStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await worker.fetch(
        new Request("https://demo.ejemplo.com/api/dashboard/demo/probe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "cf-connecting-ip": probeIp,
          },
          body: JSON.stringify({ url: "http://127.0.0.1" }),
        }),
        demoEnv,
        mockExecutionCtx
      );
      sixthStatus = res.status;
    }
    expect(sixthStatus).toBe(429);
  });
});
