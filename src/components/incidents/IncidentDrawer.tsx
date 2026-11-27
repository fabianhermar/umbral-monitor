/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  src/components/incidents/IncidentDrawer.tsx
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
 * Componente de Incidencias — `IncidentDrawer`
 * ============================================================================
 * Panel lateral deslizante con cronología, chips de IPs/rutas/cabeceras,
 * visor técnico JSON opcional y acciones de cambio de estado.
 */

import { CheckCircle2, Clock, Code2, MessageSquarePlus, RotateCcw, Search, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { addIncidentNote, fetchIncidentNotes } from "../../services/api.client";
import type { IncidentItem, IncidentNote, IncidentStatus, SiteSummary } from "../../types/dashboard.types";
import { formatIncidentDuration } from "../../utils/formatters";

interface IncidentDrawerProps {
  incident: IncidentItem | null;
  site?: SiteSummary;
  onClose: () => void;
  onUpdateStatus: (id: string, status: IncidentStatus) => Promise<void>;
}

export function IncidentDrawer({
  incident,
  site,
  onClose,
  onUpdateStatus,
}: IncidentDrawerProps) {
  const [updating, setUpdating] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [notes, setNotes] = useState<IncidentNote[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!incident) return;
    setNotes([]);
    setNoteInput("");
    fetchIncidentNotes(incident.id)
      .then((res) => setNotes(res.notes))
      .catch(() => setNotes([]));
  }, [incident]);

  if (!incident) return null;

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!incident || !noteInput.trim()) return;
    setSavingNote(true);
    try {
      const res = await addIncidentNote(incident.id, noteInput.trim());
      setNotes((prev) => [...prev, res.note]);
      setNoteInput("");
    } finally {
      setSavingNote(false);
    }
  }

  async function changeStatus(next: IncidentStatus) {
    if (!incident) return;
    setUpdating(true);
    try {
      await onUpdateStatus(incident.id, next);
    } finally {
      setUpdating(false);
    }
  }

  const meta = incident.metadata ?? {};
  const topIps = Array.isArray(meta.topIps) ? (meta.topIps as string[]) : [];
  const topPaths = Array.isArray(meta.topPaths) ? (meta.topPaths as string[]) : [];
  const missingHeaders = Array.isArray(meta.missingHeaders)
    ? (meta.missingHeaders as string[])
    : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <aside className="umbral-glass animate-slide-in relative z-10 flex h-full w-full max-w-lg flex-col border-l shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-[var(--ink-muted)] uppercase">
              <span>{incident.id}</span>
              <span>·</span>
              <span>{incident.source}</span>
            </div>
            <h2 className="mt-1.5 text-lg font-semibold leading-snug text-[var(--ink-primary)]">
              {incident.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar inspector"
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-2 text-[var(--ink-secondary)] transition hover:text-[var(--ink-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <p className="text-sm leading-relaxed text-[var(--ink-secondary)]">
            {incident.description}
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="umbral-inset rounded-xl p-3">
              <div className="font-mono text-[9.5px] tracking-wider text-[var(--ink-muted)] uppercase">
                Dominio afectado
              </div>
              <div className="mt-1 font-mono text-xs font-semibold text-[var(--ink-primary)]">
                {site?.domain ?? incident.site_id}
              </div>
            </div>

            <div className="umbral-inset rounded-xl p-3">
              <div className="font-mono text-[9.5px] tracking-wider text-[var(--ink-muted)] uppercase">
                Ocurrencias agrupadas
              </div>
              <div className="mt-1 font-mono text-xs font-semibold text-[var(--signal-vermilion)]">
                ×{incident.occurrences} evento(s)
              </div>
            </div>

            <div className="umbral-inset rounded-xl p-3">
              <div className="font-mono text-[9.5px] tracking-wider text-[var(--ink-muted)] uppercase">
                Categoría / Severidad
              </div>
              <div className="mt-1 font-mono text-xs font-semibold text-[var(--ink-primary)] uppercase">
                {incident.category} · {incident.severity}
              </div>
            </div>

            <div className="umbral-inset rounded-xl p-3">
              <div className="font-mono text-[9.5px] tracking-wider text-[var(--ink-muted)] uppercase">
                Estado actual
              </div>
              <div className="mt-1 font-mono text-xs font-semibold text-[var(--ink-primary)] uppercase">
                {incident.status}
              </div>
            </div>
          </div>

          <div className="umbral-inset rounded-xl p-4">
            <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-[var(--ink-muted)] uppercase">
              <Clock className="h-3.5 w-3.5" />
              Cronología de la incidencia
            </div>
            <div className="space-y-2.5 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--ink-muted)]">Detectada</span>
                <span className="text-[var(--ink-primary)]">
                  {new Date(incident.started_at).toLocaleString("es-MX")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--ink-muted)]">Última señal</span>
                <span className="text-[var(--ink-primary)]">
                  {new Date(incident.last_seen_at).toLocaleString("es-MX")}
                </span>
              </div>
              {incident.resolved_at && (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--signal-mint)]">Resuelta</span>
                  <span className="text-[var(--signal-mint)]">
                    {new Date(incident.resolved_at).toLocaleString("es-MX")}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2">
                <span className="text-[var(--ink-muted)]">Duración total</span>
                <span className="font-semibold text-[var(--ink-primary)]">
                  {formatIncidentDuration(incident.started_at, incident.resolved_at)}
                </span>
              </div>
            </div>
          </div>

          {/* Bitácora de Notas / Post-Mortem */}
          <div className="umbral-inset space-y-3 rounded-xl p-4">
            <div className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-[var(--ink-muted)] uppercase">
              <MessageSquarePlus className="h-3.5 w-3.5 text-[var(--signal-vermilion)]" />
              Notas de investigación ({notes.length})
            </div>

            {notes.length > 0 && (
              <div className="space-y-2">
                {notes.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-mono text-[10px] text-[var(--ink-muted)]">
                      <span>{n.author}</span>
                      <span>{new Date(n.created_at).toLocaleString("es-MX")}</span>
                    </div>
                    <p className="mt-1 text-[var(--ink-primary)]">{n.content}</p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={(e) => void handleAddNote(e)} className="flex gap-2">
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Añadir acción o nota post-mortem..."
                className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--ink-primary)] outline-none focus:border-[var(--signal-vermilion)]"
              />
              <button
                type="submit"
                disabled={savingNote || !noteInput.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--ink-primary)] px-3 py-1.5 font-mono text-[11px] font-semibold text-[var(--ink-inverse)] disabled:opacity-45"
              >
                <Send className="h-3 w-3" />
                Guardar
              </button>
            </form>
          </div>

          {(topIps.length > 0 ||
            topPaths.length > 0 ||
            missingHeaders.length > 0 ||
            Boolean(meta.clientIp)) && (
            <div className="space-y-3">
              {(topIps.length > 0 || typeof meta.clientIp === "string") && (
                <div>
                  <div className="mb-1.5 font-mono text-[10px] tracking-wider text-[var(--ink-muted)] uppercase">
                    IPs involucradas
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(topIps.length > 0 ? topIps : [String(meta.clientIp)]).map((ip) => (
                      <span
                        key={ip}
                        className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2.5 py-1 font-mono text-xs text-[var(--signal-vermilion)]"
                      >
                        {ip}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(topPaths.length > 0 || typeof meta.path === "string") && (
                <div>
                  <div className="mb-1.5 font-mono text-[10px] tracking-wider text-[var(--ink-muted)] uppercase">
                    Rutas objetivo
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(topPaths.length > 0 ? topPaths : [String(meta.path)]).map((p) => (
                      <span
                        key={p}
                        className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2.5 py-1 font-mono text-xs text-[var(--ink-primary)]"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {missingHeaders.length > 0 && (
                <div>
                  <div className="mb-1.5 font-mono text-[10px] tracking-wider text-[var(--ink-muted)] uppercase">
                    Cabeceras de seguridad faltantes
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {missingHeaders.map((h) => (
                      <span
                        key={h}
                        className="rounded-md px-2.5 py-1 font-mono text-xs"
                        style={{
                          backgroundColor: "var(--signal-ochre-soft)",
                          color: "var(--signal-ochre)",
                        }}
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
            >
              <Code2 className="h-3.5 w-3.5" />
              {showRaw ? "Ocultar payload técnico" : "Ver payload JSON y fingerprint"}
            </button>

            {showRaw && (
              <div className="umbral-inset mt-2 rounded-xl p-3">
                <div className="mb-2 font-mono text-[10px] text-[var(--ink-muted)]">
                  FINGERPRINT: {incident.fingerprint}
                </div>
                <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-[var(--ink-secondary)]">
                  {JSON.stringify(meta, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] p-4">
          {incident.status !== "resolved" ? (
            <>
              {incident.status !== "investigating" && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => void changeStatus("investigating")}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-inset)] px-3.5 py-2.5 text-xs font-semibold text-[var(--ink-primary)] transition hover:bg-[var(--bg-surface-hover)] disabled:opacity-50"
                >
                  <Search className="h-3.5 w-3.5 text-[var(--signal-ochre)]" />
                  Investigar
                </button>
              )}
              <button
                type="button"
                disabled={updating}
                onClick={() => void changeStatus("resolved")}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#06130d] transition hover:brightness-110 disabled:opacity-50"
                style={{ backgroundColor: "var(--signal-mint)" }}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Marcar resuelta
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={updating}
              onClick={() => void changeStatus("open")}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-inset)] px-4 py-2.5 text-xs font-semibold text-[var(--ink-primary)] transition hover:bg-[var(--bg-surface-hover)] disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reabrir incidencia
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
