/**
 * ============================================================================
 * Panel Lateral — `SiteDiagnosticsDrawer`
 * ============================================================================
 * Ejecuta y muestra el diagnóstico técnico profundo en vivo de cualquiera de
 * tus dominios: DNS-over-HTTPS (A, AAAA, CAA, SPF/DMARC), redirección forzada
 * HTTP -> HTTPS, auditoría extendida de 7 cabeceras y `security.txt`.
 */

import {
  CheckCircle2,
  Globe,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { inspectSiteDiagnostics } from "../../services/api.client";
import type { SiteDeepDiagnostics, SiteSummary } from "../../types/dashboard.types";

interface SiteDiagnosticsDrawerProps {
  site: SiteSummary | null;
  onClose: () => void;
}

export function SiteDiagnosticsDrawer({ site, onClose }: SiteDiagnosticsDrawerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diag, setDiag] = useState<SiteDeepDiagnostics | null>(null);

  const runInspection = useCallback(async (siteId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await inspectSiteDiagnostics(siteId);
      setDiag(res.diagnostics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error ejecutando diagnóstico");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (site) {
      setDiag(null);
      void runInspection(site.id);
    }
  }, [site, runInspection]);

  if (!site) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/55 backdrop-blur-xs" onClick={onClose} />

      <aside className="umbral-glass animate-slide-in relative z-10 flex h-full w-full max-w-xl flex-col border-l shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] p-5">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.18em] text-[var(--signal-cobalt)] uppercase">
              <ShieldCheck className="h-3.5 w-3.5" />
              DIAGNÓSTICO PROFUNDO EN VIVO
            </div>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ink-primary)]">
              {site.name} · <span className="font-mono text-sm text-[var(--ink-secondary)]">{site.domain}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void runInspection(site.id)}
              title="Repetir diagnóstico"
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-2 text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar diagnóstico"
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-2 text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {loading && !diag && (
            <div className="space-y-3">
              <div className="umbral-inset h-24 animate-pulse rounded-xl" />
              <div className="umbral-inset h-36 animate-pulse rounded-xl" />
              <div className="umbral-inset h-48 animate-pulse rounded-xl" />
            </div>
          )}

          {error && (
            <div
              className="rounded-xl p-3 font-mono text-xs"
              style={{
                backgroundColor: "var(--signal-crimson-soft)",
                color: "var(--signal-crimson)",
              }}
            >
              {error}
            </div>
          )}

          {diag && (
            <>
              {/* 1. Transporte HTTPS & Redirección HTTP -> HTTPS */}
              <div className="umbral-inset space-y-3 rounded-xl p-4">
                <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-[var(--ink-muted)] uppercase">
                  <Lock className="h-3.5 w-3.5 text-[var(--signal-mint)]" />
                  Transporte y Cifrado Edge
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div>
                    <span className="block text-[10px] text-[var(--ink-muted)]">Estado HTTPS</span>
                    <span
                      className="font-semibold"
                      style={{
                        color: diag.httpsProbe.ok ? "var(--signal-mint)" : "var(--signal-crimson)",
                      }}
                    >
                      HTTP {diag.httpsProbe.statusCode ?? "ERR"} ({diag.httpsProbe.latencyMs} ms)
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[var(--ink-muted)]">
                      Redirección HTTP → HTTPS
                    </span>
                    <span
                      className="font-semibold"
                      style={{
                        color: diag.httpToHttpsRedirect.enforced
                          ? "var(--signal-mint)"
                          : "var(--signal-ochre)",
                      }}
                    >
                      {diag.httpToHttpsRedirect.enforced
                        ? `Activa (${diag.httpToHttpsRedirect.statusCode})`
                        : "No detectada"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[var(--ink-muted)]">Servidor Borde</span>
                    <span className="text-[var(--ink-primary)]">
                      {diag.httpsProbe.server ?? "—"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-[var(--ink-muted)]">Cloudflare Ray</span>
                    <span className="text-[var(--ink-primary)]">
                      {diag.httpsProbe.cfRay ?? "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Registros DNS-over-HTTPS */}
              <div className="umbral-inset space-y-3 rounded-xl p-4">
                <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-[var(--ink-muted)] uppercase">
                  <Globe className="h-3.5 w-3.5 text-[var(--signal-cobalt)]" />
                  Registros DNS Públicos (DoH 1.1.1.1)
                </div>

                <div className="space-y-2.5 font-mono text-xs">
                  <div>
                    <span className="text-[10px] text-[var(--ink-muted)]">IPv4 (A): </span>
                    <span className="text-[var(--ink-primary)]">
                      {diag.dns.aRecords.length > 0 ? diag.dns.aRecords.join(", ") : "Sin registros A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--ink-muted)]">IPv6 (AAAA): </span>
                    <span className="text-[var(--ink-primary)]">
                      {diag.dns.aaaaRecords.length > 0
                        ? diag.dns.aaaaRecords.join(", ")
                        : "Sin registros AAAA"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--ink-muted)]">
                      Restricción de Autoridad SSL (CAA):{" "}
                    </span>
                    <span
                      style={{
                        color:
                          diag.dns.caaRecords.length > 0
                            ? "var(--signal-mint)"
                            : "var(--ink-secondary)",
                      }}
                    >
                      {diag.dns.caaRecords.length > 0
                        ? diag.dns.caaRecords.join(" · ")
                        : "No configurada (opcional)"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 pt-1 text-[11px]">
                    <span
                      style={{
                        color: diag.dns.hasSpfOrDmarc
                          ? "var(--signal-mint)"
                          : "var(--signal-ochre)",
                      }}
                    >
                      {diag.dns.hasSpfOrDmarc ? "✓ SPF / DMARC presente" : "✕ Sin SPF/DMARC"}
                    </span>
                    <span
                      style={{
                        color: diag.hasSecurityTxt
                          ? "var(--signal-mint)"
                          : "var(--ink-muted)",
                      }}
                    >
                      {diag.hasSecurityTxt
                        ? "✓ /.well-known/security.txt activo"
                        : "○ Sin security.txt"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Auditoría Extendida de 7 Cabeceras */}
              <div className="umbral-inset space-y-3 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-[var(--ink-muted)] uppercase">
                    <Server className="h-3.5 w-3.5 text-[var(--signal-vermilion)]" />
                    Auditoría Extendida (7 Cabeceras)
                  </div>
                  <span className="font-mono text-xs font-bold text-[var(--ink-primary)]">
                    {diag.headersAudit.score}/100
                  </span>
                </div>

                <div className="divide-y divide-[var(--border-subtle)]">
                  {diag.headersAudit.headers.map((h) => (
                    <div key={h.name} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--ink-primary)]">
                          {h.present ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--signal-mint)]" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 shrink-0 text-[var(--signal-ochre)]" />
                          )}
                          <span>{h.name}</span>
                        </div>
                        {h.valuePreview && (
                          <div className="mt-0.5 truncate pl-5 font-mono text-[10.5px] text-[var(--ink-muted)]">
                            {h.valuePreview}
                          </div>
                        )}
                      </div>
                      <span
                        className="shrink-0 font-mono text-[10px] uppercase"
                        style={{
                          color: h.present ? "var(--signal-mint)" : "var(--signal-ochre)",
                        }}
                      >
                        {h.present ? "OK" : "FALTA"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
