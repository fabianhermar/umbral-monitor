/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  scripts/e2e-ci.mjs
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
 * Corredor E2E Real sobre Cloudflare `workerd` + SQLite D1 (Local & GitHub CI)
 * ============================================================================
 * Levanta el binario real de Cloudflare Workers (`wrangler dev`) en dos fases:
 *  1. Instancia Privada (`wrangler.jsonc`) con D1 SQLite real, autenticación
 *     de producción, HMAC-SHA256, Anti-Replay, notas post-mortem y modo silencio.
 *  2. Instancia Demo (`wrangler.demo.jsonc`) validando aislamiento total,
 *     bloqueo de `/api/ingest` y protección Anti-SSRF.
 */

import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";

const IS_WIN = process.platform === "win32";
const NPX_BIN = IS_WIN ? "npx.cmd" : "npx";

const CI_API_KEY = "ci_e2e_master_dashboard_key_2026_secure!";
const CI_SITE_ID = "e2e-test-site";
const CI_SITE_DOMAIN = "e2e.ejemplo.com";
const CI_SITE_SECRET = "ci_e2e_hmac_secret_32_characters_ok!";

const CI_SITES_JSON = JSON.stringify([
  {
    id: CI_SITE_ID,
    name: "E2E Site",
    domain: CI_SITE_DOMAIN,
    allowedHosts: [CI_SITE_DOMAIN],
    checkUrl: `https://${CI_SITE_DOMAIN}`,
  },
]);

const CI_SECRETS_JSON = JSON.stringify({
  [CI_SITE_ID]: CI_SITE_SECRET,
});

function killProcess(proc) {
  if (!proc?.pid) return;
  proc.stdout?.destroy();
  proc.stderr?.destroy();
  proc.unref?.();

  if (IS_WIN) {
    spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-proc.pid, "SIGKILL");
    } catch {
      // Ignorar si el grupo de procesos ya terminó
    }
    try {
      proc.kill("SIGKILL");
    } catch {
      // Ignorar si el proceso ya terminó
    }
  }
}

async function waitForHealth(baseUrl, timeoutLoops = 50) {
  for (let i = 0; i < timeoutLoops; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return true;
    } catch {
      // Esperar a que workerd escuche en el puerto
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function runPrivateWorkerE2E() {
  const port = 8791;
  const base = `http://127.0.0.1:${port}`;

  // Archivo de entorno efímero aislado para no depender ni leer .dev.vars locales
  const tempEnvPath = ".dev.vars.e2e.tmp";
  fs.writeFileSync(
    tempEnvPath,
    [
      "ENVIRONMENT=production",
      "DASHBOARD_ADMIN_EMAIL=ci@ejemplo.com",
      `DASHBOARD_API_KEY=${CI_API_KEY}`,
      `SITES_CONFIG_JSON=${CI_SITES_JSON}`,
      `SITE_SECRETS_JSON=${CI_SECRETS_JSON}`,
    ].join("\n")
  );

  const proc = spawn(
    NPX_BIN,
    ["wrangler", "dev", "--env-file", tempEnvPath, "--port", String(port), "--ip", "127.0.0.1"],
    { shell: IS_WIN, detached: !IS_WIN, stdio: ["ignore", "pipe", "pipe"] }
  );

  let logs = "";
  proc.stdout.on("data", (d) => (logs += d.toString()));
  proc.stderr.on("data", (d) => (logs += d.toString()));

  const results = [];

  try {
    const ready = await waitForHealth(base);
    if (!ready) {
      throw new Error(`Private Worker no inició a tiempo:\n${logs}`);
    }

    // 1. SPA estática + cabeceras defensivas
    const spaRes = await fetch(base);
    const spaHtml = await spaRes.text();
    results.push([
      "E2E Privado: SPA compilada servida (200)",
      spaRes.status === 200 && spaHtml.includes("UMBRAL"),
      spaRes.status,
    ]);

    const healthRes = await fetch(`${base}/api/health`);
    const hasCsp = Boolean(healthRes.headers.get("content-security-policy"));
    const hasHsts = Boolean(healthRes.headers.get("strict-transport-security"));
    results.push([
      "E2E Privado: Cabeceras CSP y HSTS activas",
      hasCsp && hasHsts,
      `csp=${hasCsp}, hsts=${hasHsts}`,
    ]);

    // 2. Bloqueo sin credenciales y contra suplantación Cf-Access en producción
    const unauthRes = await fetch(`${base}/api/dashboard/overview`, {
      headers: {
        "Cf-Access-Authenticated-User-Email": "ci@ejemplo.com",
        "Cf-Access-Jwt-Assertion": "token.falso.suplantado",
      },
    });
    results.push([
      "E2E Privado: Suplantación Cf-Access bloqueada -> 401",
      unauthRes.status === 401,
      unauthRes.status,
    ]);

    // 3. Acceso legítimo con X-Dashboard-Key
    const authHeaders = {
      "X-Dashboard-Key": CI_API_KEY,
      "Content-Type": "application/json",
    };
    const ovRes = await fetch(`${base}/api/dashboard/overview`, { headers: authHeaders });
    const ov = await ovRes.json();
    results.push([
      "E2E Privado: Overview autenticado OK",
      ovRes.status === 200 && ov.sites?.length === 1 && ov.sites[0].id === CI_SITE_ID,
      `status=${ovRes.status}, site=${ov.sites?.[0]?.id}`,
    ]);

    // 4. Ingesta rechaza sitio externo (403), firma inválida (401) y host ajeno (403)
    const ts = String(Math.floor(Date.now() / 1000));
    const r403 = await fetch(`${base}/api/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-site-id": "sitio-intruso",
        "x-timestamp": ts,
        "x-signature": "0".repeat(64),
      },
      body: JSON.stringify({ category: "error", severity: "low", title: "a", description: "b" }),
    });
    results.push(["E2E Privado: Sitio ajeno -> 403", r403.status === 403, r403.status]);

    // 5. Ingesta HMAC válida (201) + bloqueo Anti-Replay inmediato (409)
    const validPayload = JSON.stringify({
      category: "security",
      severity: "medium",
      title: "Prueba CI E2E",
      description: "Verificación de extremo a extremo en D1",
      host: CI_SITE_DOMAIN,
      path: "/api/ci-check",
    });
    const sig = crypto
      .createHmac("sha256", CI_SITE_SECRET)
      .update(`${ts}.${validPayload}`)
      .digest("hex");

    const r201 = await fetch(`${base}/api/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-site-id": CI_SITE_ID,
        "x-timestamp": ts,
        "x-signature": sig,
      },
      body: validPayload,
    });
    const r201Json = await r201.json();
    results.push([
      "E2E Privado: Ingesta HMAC válida -> 201",
      r201.status === 201 && Boolean(r201Json.incidentId),
      `${r201.status} (${r201Json.incidentId})`,
    ]);

    const r409 = await fetch(`${base}/api/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-site-id": CI_SITE_ID,
        "x-timestamp": ts,
        "x-signature": sig,
      },
      body: validPayload,
    });
    results.push(["E2E Privado: Anti-Replay -> 409", r409.status === 409, r409.status]);

    // 6. Notas post-mortem + Resolución en lote + Modo Mantenimiento en D1
    if (r201Json.incidentId) {
      const noteRes = await fetch(
        `${base}/api/dashboard/incidents/${r201Json.incidentId}/notes`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({ content: "Nota CI verificada" }),
        }
      );
      const bulkRes = await fetch(`${base}/api/dashboard/incidents/bulk-status`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ ids: [r201Json.incidentId], status: "resolved" }),
      });
      results.push([
        "E2E Privado: Notas post-mortem + Bulk Resolve en D1",
        noteRes.status === 201 && bulkRes.status === 200,
        `note=${noteRes.status}, bulk=${bulkRes.status}`,
      ]);
    }

    const muteRes = await fetch(`${base}/api/dashboard/sites/${CI_SITE_ID}/mute`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ minutes: 0 }),
    });
    results.push(["E2E Privado: Modo Mantenimiento D1", muteRes.status === 200, muteRes.status]);
  } finally {
    killProcess(proc);
    await new Promise((r) => setTimeout(r, 400));
    if (fs.existsSync(tempEnvPath)) {
      fs.unlinkSync(tempEnvPath);
    }
  }

  return results;
}

async function runDemoWorkerE2E() {
  const port = 8792;
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn(
    NPX_BIN,
    [
      "wrangler",
      "dev",
      "--config",
      "wrangler.demo.jsonc",
      "--port",
      String(port),
      "--ip",
      "127.0.0.1",
    ],
    { shell: IS_WIN, detached: !IS_WIN, stdio: ["ignore", "pipe", "pipe"] }
  );

  let logs = "";
  proc.stdout.on("data", (d) => (logs += d.toString()));
  proc.stderr.on("data", (d) => (logs += d.toString()));

  const results = [];

  try {
    const ready = await waitForHealth(base);
    if (!ready) {
      throw new Error(`Demo Worker no inició a tiempo:\n${logs}`);
    }

    const ovRes = await fetch(`${base}/api/dashboard/overview`);
    const ov = await ovRes.json();
    results.push([
      "E2E Demo: Aislamiento isDemo=true (4 dominios .demo)",
      ovRes.status === 200 && ov.isDemo === true && ov.sites?.length === 4,
      `sites=${ov.sites?.length}`,
    ]);

    const ingestRes = await fetch(`${base}/api/ingest`, { method: "POST" });
    results.push(["E2E Demo: /api/ingest bloqueado -> 403", ingestRes.status === 403, ingestRes.status]);

    const ssrfRes = await fetch(`${base}/api/dashboard/demo/probe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://169.254.169.254/latest/meta-data" }),
    });
    const ssrfJson = await ssrfRes.json();
    results.push([
      "E2E Demo: Anti-SSRF bloquea IP de metadata cloud",
      ssrfRes.status === 200 && ssrfJson.result?.ok === false,
      ssrfJson.result?.error,
    ]);
  } finally {
    killProcess(proc);
  }

  return results;
}

const allResults = [...(await runPrivateWorkerE2E()), ...(await runDemoWorkerE2E())];
let failed = false;
for (const [name, pass, detail] of allResults) {
  console.log(`${pass ? "PASS" : "FAIL"} | ${name} (${detail})`);
  if (!pass) failed = true;
}

process.exit(failed ? 1 : 0);
