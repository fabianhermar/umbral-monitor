/**
 * ============================================================================
 * Componente de Vista General — `DomainMonoliths`
 * ============================================================================
 * Muestra cada uno de tus dominios permitidos como un módulo instrumental con
 * tira de 24 pulsos, métricas tabulares y conectores Cloudflare/Vercel.
 */

import { ArrowUpRight, BellOff, BellRing, Shield, ShieldAlert, Stethoscope } from "lucide-react";
import type { SiteOperationalStatus, SiteSummary } from "../../types/dashboard.types";
import { formatRelativeTime } from "../../utils/formatters";
import { InfoTip } from "../ui/InfoTip";

interface DomainMonolithsProps {
  sites: SiteSummary[];
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
  onInspectSite: (site: SiteSummary) => void;
  onToggleMuteSite: (site: SiteSummary) => void;
}

const STATUS_META: Record<
  SiteOperationalStatus,
  { label: string; color: string; bg: string }
> = {
  up: { label: "OPERATIVO", color: "var(--signal-mint)", bg: "var(--signal-mint-soft)" },
  degraded: { label: "DEGRADADO", color: "var(--signal-ochre)", bg: "var(--signal-ochre-soft)" },
  down: { label: "CAÍDO", color: "var(--signal-crimson)", bg: "var(--signal-crimson-soft)" },
  under_attack: {
    label: "BAJO ATAQUE",
    color: "var(--signal-vermilion)",
    bg: "var(--signal-vermilion-soft)",
  },
  unknown: { label: "SIN SEÑAL", color: "var(--ink-muted)", bg: "var(--bg-inset)" },
};

export function DomainMonoliths({
  sites,
  selectedSiteId,
  onSelectSite,
  onInspectSite,
  onToggleMuteSite,
}: DomainMonolithsProps) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <span className="font-mono text-[10px] tracking-[0.18em] text-[var(--ink-muted)] uppercase">
            01 // DOMINIOS PERMITIDOS
          </span>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[var(--ink-primary)]">
            Módulos de Vigilancia Propios
          </h2>
        </div>
        <span className="font-mono text-[11px] text-[var(--ink-muted)]">
          config/sites.config.ts
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {sites.map((site, index) => {
          const st = STATUS_META[site.status] ?? STATUS_META.unknown;
          const isSelected = selectedSiteId === site.id;

          return (
            <article
              key={site.id}
              onClick={() => onSelectSite(isSelected ? "all" : site.id)}
              className={`umbral-panel umbral-panel-interactive animate-fade-up cursor-pointer rounded-2xl p-5 ${
                isSelected ? "ring-1 ring-[var(--signal-vermilion)]" : ""
              }`}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] tracking-[0.18em] text-[var(--ink-muted)]">
                      NODE_{String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider"
                      style={{ color: st.color, backgroundColor: st.bg }}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          site.status === "down" || site.status === "under_attack"
                            ? "animate-pulse"
                            : ""
                        }`}
                        style={{ backgroundColor: st.color }}
                      />
                      {st.label}
                    </span>
                    <InfoTip glossaryKey={`status-${site.status}`} align="left" />
                  </div>

                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--ink-primary)]">
                    {site.name}
                  </h3>

                  <a
                    href={site.checkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-[var(--ink-secondary)] transition hover:text-[var(--signal-vermilion)]"
                  >
                    {site.domain}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>

                <div className="text-right">
                  <div className="font-mono text-xl font-semibold text-[var(--ink-primary)] tabular-nums">
                    {site.uptime24h !== null ? `${site.uptime24h}%` : "—"}
                  </div>
                  <div className="font-mono text-[10px] text-[var(--ink-muted)]">
                    {formatRelativeTime(site.lastCheckedAt)}
                  </div>
                </div>
              </div>

              {/* Tira de 24 pulsos */}
              <div className="mt-4">
                <div className="umbral-inset rounded-xl p-2.5">
                  <div className="flex h-8 items-end gap-[3px]">
                    {Array.from({ length: 24 }).map((_, i) => {
                      const point = site.recentBars[i - (24 - site.recentBars.length)];
                      if (!point) {
                        return (
                          <div
                            key={i}
                            className="h-3 flex-1 rounded-[2px] bg-[var(--border-subtle)]"
                            title="Sin muestra"
                          />
                        );
                      }
                      const barColor = !point.ok
                        ? "var(--signal-crimson)"
                        : point.latencyMs > 2000
                          ? "var(--signal-ochre)"
                          : "var(--signal-mint)";
                      const heightPct = !point.ok
                        ? 100
                        : Math.min(100, Math.max(32, Math.round((point.latencyMs / 2500) * 100)));
                      return (
                        <div
                          key={i}
                          className="flex-1 rounded-[2px] transition-opacity hover:opacity-75"
                          style={{ height: `${heightPct}%`, backgroundColor: barColor }}
                          title={`${new Date(point.checkedAt).toLocaleTimeString("es-MX")} · HTTP ${point.statusCode ?? "ERR"} · ${point.latencyMs} ms`}
                        />
                      );
                    })}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between font-mono text-[9px] tracking-wider text-[var(--ink-muted)] uppercase">
                    <span className="inline-flex items-center gap-1">
                      -24 pulsos
                      <InfoTip glossaryKey="signal-strip" align="left" />
                    </span>
                    <span>HTTP {site.lastStatusCode ?? "—"}</span>
                    <span>Ahora</span>
                  </div>
                </div>
              </div>

              {/* Lectura instrumental de 4 celdas */}
              <div className="mt-4 grid grid-cols-4 divide-x divide-[var(--border-subtle)] border-y border-[var(--border-subtle)] py-2.5">
                <div className="pr-2">
                  <div className="font-mono text-[9.5px] text-[var(--ink-muted)] uppercase">
                    Latencia
                  </div>
                  <div className="mt-0.5 font-mono text-xs font-semibold text-[var(--ink-primary)] tabular-nums">
                    {site.lastLatencyMs !== null ? `${site.lastLatencyMs}ms` : "—"}
                  </div>
                </div>

                <div className="px-2.5">
                  <div className="font-mono text-[9.5px] text-[var(--ink-muted)] uppercase">
                    Alertas
                  </div>
                  <div
                    className="mt-0.5 font-mono text-xs font-semibold tabular-nums"
                    style={{
                      color:
                        site.openIncidentsCount > 0 ? "var(--signal-ochre)" : "var(--signal-mint)",
                    }}
                  >
                    {site.openIncidentsCount}
                  </div>
                </div>

                <div className="px-2.5">
                  <div className="font-mono text-[9.5px] text-[var(--ink-muted)] uppercase">
                    Bloqueos
                  </div>
                  <div className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs font-semibold text-[var(--ink-primary)] tabular-nums">
                    {site.securityEvents24h > 0 ? (
                      <ShieldAlert className="h-3 w-3 text-[var(--signal-vermilion)]" />
                    ) : (
                      <Shield className="h-3 w-3 text-[var(--ink-muted)]" />
                    )}
                    {site.securityEvents24h}
                  </div>
                </div>

                <div className="pl-2.5">
                  <div className="inline-flex items-center gap-1 font-mono text-[9.5px] text-[var(--ink-muted)] uppercase">
                    <span>HDR</span>
                    <InfoTip glossaryKey="metric-hdr" align="right" />
                  </div>
                  <div
                    className="mt-0.5 font-mono text-xs font-semibold tabular-nums"
                    style={{
                      color:
                        site.securityScore >= 100
                          ? "var(--signal-mint)"
                          : site.securityScore >= 75
                            ? "var(--signal-ochre)"
                            : "var(--signal-crimson)",
                    }}
                  >
                    {site.securityScore}/100
                  </div>
                </div>
              </div>

              {/* Conectores de sincronización */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px]">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[var(--ink-secondary)]">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: site.hasCloudflareZone
                          ? "var(--signal-vermilion)"
                          : "var(--ink-muted)",
                      }}
                    />
                    CF {site.hasCloudflareZone ? "SYNC" : "SIN ZONE"}
                  </span>

                  <span className="inline-flex items-center gap-1.5 text-[var(--ink-secondary)]">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor:
                          site.lastVercelState === "ERROR"
                            ? "var(--signal-crimson)"
                            : site.hasVercelProject
                              ? "var(--signal-mint)"
                              : "var(--ink-muted)",
                      }}
                    />
                    VERCEL {site.lastVercelState ?? (site.hasVercelProject ? "SYNC" : "SIN ID")}
                  </span>
                  <InfoTip glossaryKey="cf-vercel-sync" align="left" />
                </div>

                <span className="text-[var(--ink-muted)]">
                  SLA {site.slaBudgetRemainingPct ?? 100}%
                </span>
              </div>

              {/* Barra rápida de acciones operativas por dominio */}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2.5 font-mono text-[10.5px]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspectSite(site);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2.5 py-1 text-[var(--ink-secondary)] transition hover:border-[var(--signal-cobalt)] hover:text-[var(--signal-cobalt)]"
                >
                  <Stethoscope className="h-3 w-3" />
                  Diagnóstico DNS/SSL
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleMuteSite(site);
                  }}
                  title="Pausar o reanudar alertas push (Telegram/Discord) para este dominio"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition ${
                    site.mutedUntil
                      ? "border-[var(--signal-ochre)] bg-[var(--signal-ochre-soft)] text-[var(--signal-ochre)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                  }`}
                >
                  {site.mutedUntil ? (
                    <>
                      <BellOff className="h-3 w-3" />
                      Silenciado (Reanudar)
                    </>
                  ) : (
                    <>
                      <BellRing className="h-3 w-3" />
                      Silenciar 1h
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
