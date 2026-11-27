/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  src/components/modals/GlossaryDrawer.tsx
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
 * Panel Buscable — `GlossaryDrawer` (Manual de Referencia Completo)
 * ============================================================================
 * Explica los 26 conceptos, estados, siglas (`UP`, `HDR`, `DEF`, `P50`, `P95`),
 * categorías, severidades, códigos `52x` y capas de seguridad de UMBRAL.
 */

import { BookOpen, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  GLOSSARY_ENTRIES,
  GLOSSARY_GROUPS,
  type GlossaryGroup,
} from "../../constants/glossary";

interface GlossaryDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function GlossaryDrawer({ open, onClose }: GlossaryDrawerProps) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GlossaryGroup | "all">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GLOSSARY_ENTRIES.filter((entry) => {
      if (group !== "all" && entry.group !== group) return false;
      if (!q) return true;
      return (
        entry.term.toLowerCase().includes(q) ||
        entry.summary.toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q) ||
        (entry.shortTag?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [query, group]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/55 backdrop-blur-xs" onClick={onClose} />

      <aside className="umbral-glass animate-slide-in relative z-10 flex h-full w-full max-w-xl flex-col border-l shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] p-5">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-[var(--signal-vermilion)] uppercase">
              <BookOpen className="h-3.5 w-3.5" />
              MANUAL DE REFERENCIA // UMBRAL
            </div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ink-primary)]">
              ¿Qué significa cada dato y estado?
            </h2>
            <p className="mt-0.5 text-xs text-[var(--ink-secondary)]">
              Glosario completo de estados, siglas (UP, HDR, DEF, P50, P95), categorías, acciones WAF y códigos HTTP.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar guía"
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-2 text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 border-b border-[var(--border-subtle)] p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar: HDR, DEF, degradado, 522, P95, HMAC, block..."
              className="umbral-inset w-full rounded-xl py-2 pr-3 pl-9 text-xs text-[var(--ink-primary)] outline-none placeholder:text-[var(--ink-muted)] focus:border-[var(--signal-vermilion)]"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {GLOSSARY_GROUPS.map((g) => {
              const active = group === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGroup(g.id)}
                  className={`rounded-lg px-2.5 py-1 font-mono text-[10.5px] transition ${
                    active
                      ? "bg-[var(--ink-primary)] font-semibold text-[var(--ink-inverse)]"
                      : "border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--ink-muted)]">
              No se encontraron conceptos para &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filtered.map((entry) => (
              <article
                key={entry.key}
                className="umbral-inset relative overflow-hidden rounded-xl p-4"
              >
                <span
                  className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full"
                  style={{ backgroundColor: entry.accent ?? "var(--ink-muted)" }}
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pl-2">
                  <h3 className="font-mono text-xs font-semibold text-[var(--ink-primary)]">
                    {entry.term}
                  </h3>
                  {entry.shortTag && (
                    <span
                      className="rounded px-2 py-0.5 font-mono text-[9.5px] uppercase"
                      style={{
                        backgroundColor: "var(--bg-surface)",
                        color: entry.accent ?? "var(--ink-secondary)",
                      }}
                    >
                      {entry.shortTag}
                    </span>
                  )}
                </div>

                <p className="mt-1.5 pl-2 text-xs font-medium text-[var(--ink-primary)]">
                  {entry.summary}
                </p>
                <p className="mt-1 pl-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
                  {entry.details}
                </p>
              </article>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] px-5 py-3 font-mono text-[10.5px] text-[var(--ink-muted)]">
          <span>{filtered.length} concepto(s) documentado(s)</span>
          <span>
            Atajo: <kbd className="rounded border border-[var(--border-strong)] px-1">?</kbd> abrir guía
          </span>
        </div>
      </aside>
    </div>
  );
}
