/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  src/components/demo/DemoShowcaseBar.tsx
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
 * Panel de Demostración Pública — `DemoShowcaseBar`
 * ============================================================================
 * Solo se renderiza cuando el Worker corre con `DEMO_MODE=true`.
 * Permite a cualquier visitante:
 *  1. Simular ataques WAF o caídas 522 para ver la reacción en vivo del panel.
 *  2. Analizar una URL pública de prueba (latencia real + auditoría HDR) con
 *     protección anti-SSRF y rate-limit en el backend.
 */

import {
  CheckCircle2,
  Flame,
  Globe,
  RotateCcw,
  Search,
  Sparkles,
  WifiOff,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import {
  resetDemoData,
  runDemoProbe,
  simulateDemoIncident,
} from "../../services/api.client";
import type { DemoProbeResult } from "../../types/dashboard.types";

interface DemoShowcaseBarProps {
  onRefreshDashboard: () => void;
}

const SAFE_PRESETS = [
  { label: "example.com", url: "https://example.com" },
  { label: "cloudflare.com", url: "https://www.cloudflare.com" },
  { label: "vercel.com", url: "https://vercel.com" },
  { label: "github.com", url: "https://github.com" },
];

export function DemoShowcaseBar({ onRefreshDashboard }: DemoShowcaseBarProps) {
  const [urlInput, setUrlInput] = useState("https://example.com");
  const [probing, setProbing] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [result, setResult] = useState<DemoProbeResult | null>(null);

  async function handleProbe(targetUrl?: string) {
    const url = (targetUrl ?? urlInput).trim();
    if (!url) return;
    setUrlInput(url);
    setProbing(true);
    setProbeError(null);
    try {
      const res = await runDemoProbe(url);
      setResult(res.result);
    } catch (err) {
      setProbeError(err instanceof Error ? err.message : "Error analizando URL");
    } finally {
      setProbing(false);
    }
  }

  async function handleSimulate(kind: "attack" | "downtime") {
    setSimulating(true);
    try {
      await simulateDemoIncident(kind);
      onRefreshDashboard();
    } finally {
      setSimulating(false);
    }
  }

  async function handleReset() {
    setSimulating(true);
    try {
      await resetDemoData();
      setResult(null);
      setProbeError(null);
      onRefreshDashboard();
    } finally {
      setSimulating(false);
    }
  }

  return (
    <section
      className="umbral-panel animate-fade-up rounded-2xl p-4 sm:p-5"
      style={{ borderColor: "var(--signal-vermilion)" }}
    >
      {/* Cabecera del Modo Demo + Simuladores */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wider uppercase"
            style={{
              backgroundColor: "var(--signal-vermilion-soft)",
              color: "var(--signal-vermilion)",
            }}
          >
            <Sparkles className="h-3 w-3" />
            MODO DEMO INTERACTIVO
          </span>
          <p className="text-xs text-[var(--ink-secondary)]">
            Todos los dominios e incidencias mostrados son ficticios. Prueba simular eventos o
            analizar una página pública en vivo:
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={simulating}
            onClick={() => void handleSimulate("attack")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-inset)] px-3 py-1.5 font-mono text-[11px] font-medium text-[var(--ink-primary)] transition hover:border-[var(--signal-vermilion)] hover:text-[var(--signal-vermilion)] disabled:opacity-50"
          >
            <Flame className="h-3.5 w-3.5 text-[var(--signal-vermilion)]" />
            Simular ataque WAF
          </button>

          <button
            type="button"
            disabled={simulating}
            onClick={() => void handleSimulate("downtime")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-inset)] px-3 py-1.5 font-mono text-[11px] font-medium text-[var(--ink-primary)] transition hover:border-[var(--signal-crimson)] hover:text-[var(--signal-crimson)] disabled:opacity-50"
          >
            <WifiOff className="h-3.5 w-3.5 text-[var(--signal-crimson)]" />
            Simular caída 522
          </button>

          <button
            type="button"
            disabled={simulating}
            onClick={() => void handleReset()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-1.5 font-mono text-[11px] text-[var(--ink-secondary)] transition hover:text-[var(--ink-primary)] disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" />
            Restablecer
          </button>
        </div>
      </div>

      {/* Analizador de Página de Prueba en Vivo */}
      <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleProbe();
          }}
          className="flex flex-col gap-2.5 sm:flex-row"
        >
          <div className="relative flex-1">
            <Globe className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com — Prueba analizar cualquier página pública HTTPS"
              className="umbral-inset w-full rounded-xl py-2 pr-3 pl-9 font-mono text-xs text-[var(--ink-primary)] outline-none focus:border-[var(--signal-vermilion)]"
            />
          </div>

          <button
            type="submit"
            disabled={probing}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--ink-primary)] px-4 py-2 font-mono text-xs font-semibold text-[var(--ink-inverse)] transition hover:opacity-90 disabled:opacity-50"
          >
            <Search className="h-3.5 w-3.5" />
            {probing ? "Analizando..." : "Analizar página de prueba"}
          </button>
        </form>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 font-mono text-[10.5px]">
          <span className="text-[var(--ink-muted)]">Pruebas rápidas:</span>
          {SAFE_PRESETS.map((p) => (
            <button
              key={p.url}
              type="button"
              onClick={() => void handleProbe(p.url)}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2 py-0.5 text-[var(--ink-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)]"
            >
              {p.label}
            </button>
          ))}
        </div>

        {probeError && (
          <p
            className="mt-3 rounded-xl px-3 py-2 font-mono text-xs"
            style={{
              backgroundColor: "var(--signal-crimson-soft)",
              color: "var(--signal-crimson)",
            }}
          >
            {probeError}
          </p>
        )}

        {result && (
          <div className="umbral-inset mt-3 rounded-xl p-3.5">
            {result.error ? (
              <div className="flex items-center gap-2 font-mono text-xs text-[var(--signal-crimson)]">
                <XCircle className="h-4 w-4 shrink-0" />
                <span>{result.error}</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    {result.ok ? (
                      <CheckCircle2 className="h-4 w-4 text-[var(--signal-mint)]" />
                    ) : (
                      <XCircle className="h-4 w-4 text-[var(--signal-crimson)]" />
                    )}
                    <span className="font-semibold text-[var(--ink-primary)]">
                      {result.finalUrl}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                    <span
                      className="rounded px-2 py-0.5 font-semibold"
                      style={{
                        backgroundColor: result.ok
                          ? "var(--signal-mint-soft)"
                          : "var(--signal-crimson-soft)",
                        color: result.ok ? "var(--signal-mint)" : "var(--signal-crimson)",
                      }}
                    >
                      HTTP {result.statusCode ?? "ERR"}
                    </span>
                    <span className="rounded bg-[var(--bg-surface)] px-2 py-0.5 text-[var(--ink-primary)]">
                      {result.latencyMs} ms
                    </span>
                    <span
                      className="rounded px-2 py-0.5 font-semibold"
                      style={{
                        backgroundColor:
                          result.securityScore >= 100
                            ? "var(--signal-mint-soft)"
                            : "var(--signal-ochre-soft)",
                        color:
                          result.securityScore >= 100
                            ? "var(--signal-mint)"
                            : "var(--signal-ochre)",
                      }}
                    >
                      HDR {result.securityScore}/100
                    </span>
                    {result.server && (
                      <span className="rounded bg-[var(--bg-surface)] px-2 py-0.5 text-[var(--ink-muted)]">
                        {result.server}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 font-mono text-[10.5px]">
                  {result.presentHeaders.map((h) => (
                    <span
                      key={h}
                      className="rounded px-2 py-0.5"
                      style={{
                        backgroundColor: "var(--signal-mint-soft)",
                        color: "var(--signal-mint)",
                      }}
                    >
                      ✓ {h}
                    </span>
                  ))}
                  {result.missingHeaders.map((h) => (
                    <span
                      key={h}
                      className="rounded px-2 py-0.5"
                      style={{
                        backgroundColor: "var(--signal-ochre-soft)",
                        color: "var(--signal-ochre)",
                      }}
                    >
                      ✕ {h}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
