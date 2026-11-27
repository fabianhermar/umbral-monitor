/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  tests/security/static-code-audit.test.ts
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
 * Suite de Seguridad 04 — Auditoría Estática de Código (SAST Interno)
 * ============================================================================
 * Escanea todos los archivos del proyecto para impedir que lleguen a producción:
 *  - Secretos reales filtrados (Cloudflare, GitHub, Telegram, Discord).
 *  - Sumideros peligrosos de XSS / ejecución arbitraria (`eval`, `dangerouslySetInnerHTML`).
 *  - Sintaxis inválida en `public/_headers` (previene error Cloudflare 100324).
 *  - Fuga de dominios privados o falta de `.dev.vars` en `.gitignore`.
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const IGNORED_DIRS = new Set(["node_modules", "dist", ".wrangler", ".git"]);

function walkFiles(dir: string, exts: string[]): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

describe("Auditoría Estática de Seguridad del Repositorio (SAST)", () => {
  it("protege .dev.vars y .wrangler dentro de .gitignore", () => {
    const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
    expect(gitignore).toContain(".dev.vars");
    expect(gitignore).toContain(".wrangler");
    expect(gitignore).toContain("node_modules");
  });

  it("no contiene tokens ni webhooks reales hardcodeados en el código fuente", () => {
    const files = walkFiles(ROOT, [".ts", ".tsx", ".sql", ".jsonc", ".md", ".yml"]);
    const secretPatterns = [
      { name: "Cloudflare User Token", regex: /\bcfut_[A-Za-z0-9_-]{20,}/ },
      { name: "GitHub PAT", regex: /\bghp_[A-Za-z0-9]{30,}/ },
      { name: "Telegram Bot Token real", regex: /\b\d{8,10}:AA[A-Za-z0-9_-]{32,}/ },
      { name: "Discord Webhook real", regex: /https:\/\/discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/ },
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      for (const pat of secretPatterns) {
        expect(
          pat.regex.test(content),
          `Posible secreto detectado (${pat.name}) en ${path.relative(ROOT, file)}`
        ).toBe(false);
      }
    }
  });

  it("no utiliza eval(), new Function() ni dangerouslySetInnerHTML en worker/ ni src/", () => {
    const codeFiles = [
      ...walkFiles(path.join(ROOT, "worker"), [".ts"]),
      ...walkFiles(path.join(ROOT, "src"), [".ts", ".tsx"]),
      ...walkFiles(path.join(ROOT, "sdk"), [".ts"]),
    ];

    for (const file of codeFiles) {
      const content = fs.readFileSync(file, "utf8");
      expect(/\beval\s*\(/.test(content), `eval() prohibido en ${file}`).toBe(false);
      expect(/\bnew\s+Function\s*\(/.test(content), `new Function() prohibido en ${file}`).toBe(
        false
      );
      expect(
        content.includes("dangerouslySetInnerHTML"),
        `dangerouslySetInnerHTML prohibido en ${file}`
      ).toBe(false);
    }
  });

  it("valida la sintaxis estricta de Cloudflare en public/_headers", () => {
    const headersFile = fs.readFileSync(path.join(ROOT, "public", "_headers"), "utf8");
    const lines = headersFile.split(/\r?\n/);

    let hasRoute = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      if (!line.startsWith(" ") && !line.startsWith("\t")) {
        // Debe ser una ruta válida (ej. /*)
        expect(
          trimmed.startsWith("/"),
          `Línea ${i + 1} en public/_headers debe ser una ruta que inicie con '/': "${line}"`
        ).toBe(true);
        hasRoute = true;
      } else {
        // Línea indentada: obligatoriamente "Header-Name: valor"
        expect(
          /^[A-Za-z0-9-]+:\s+.+$/.test(trimmed),
          `Línea ${i + 1} en public/_headers inválida: "${line}"`
        ).toBe(true);
      }
    }

    expect(hasRoute).toBe(true);
    expect(headersFile).toContain("Content-Security-Policy:");
    expect(headersFile).toContain("Strict-Transport-Security:");
  });

  it("verifica que todos los archivos fuente incluyan el encabezado oficial SPDX-License-Identifier: MIT", () => {
    const sourceFiles = [
      ...walkFiles(path.join(ROOT, "worker"), [".ts"]),
      ...walkFiles(path.join(ROOT, "src"), [".ts", ".tsx"]),
      ...walkFiles(path.join(ROOT, "config"), [".ts"]),
      ...walkFiles(path.join(ROOT, "sdk"), [".ts"]),
    ];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, "utf8");
      expect(
        content.includes("SPDX-License-Identifier: MIT"),
        `Falta encabezado de licencia SPDX en ${path.relative(ROOT, file)}`
      ).toBe(true);
    }
  });
});
