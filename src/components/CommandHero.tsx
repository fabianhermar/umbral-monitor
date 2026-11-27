import { BookOpen, Lock, Play, RefreshCw } from "lucide-react";
import type { OverviewResponse, SiteOperationalStatus } from "../types";
import { InfoTip } from "./InfoTip";
import { UmbralLogo } from "./UmbralLogo";

interface CommandHeroProps {
  overview: OverviewResponse;
  selectedSiteId: string;
  onSelectSite: (siteId: string) => void;
  onRefresh: () => void;
  onRunChecks: () => void;
  onOpenGlossary: () => void;
  isRefreshing: boolean;
  isRunningChecks: boolean;
  healthStatus: "healthy" | "warning" | "critical";
}

function statusDotColor(status: SiteOperationalStatus): string {
  switch (status) {
    case "up":
      return "var(--signal-mint)";
    case "degraded":
      return "var(--signal-ochre)";
    case "down":
      return "var(--signal-crimson)";
    case "under_attack":
      return "var(--signal-vermilion)";
    default:
      return "var(--ink-muted)";
  }
}

export function CommandHero({
  overview,
  selectedSiteId,
  onSelectSite,
  onRefresh,
  onRunChecks,
  onOpenGlossary,
  isRefreshing,
  isRunningChecks,
  healthStatus,
}: CommandHeroProps) {
  const { kpis, auth, sites } = overview;

  const headline =
    healthStatus === "critical"
      ? {
          main: "Interrupción crítica",
          editorial: "en tu perímetro.",
        }
      : healthStatus === "warning"
        ? {
            main: "Señales activas",
            editorial: "bajo observación.",
          }
        : {
            main: "Todos los umbrales",
            editorial: "en calma absoluta.",
          };

  const authBadge =
    auth.mode === "cloudflare-access"
      ? `CF ACCESS · ${auth.user}`
      : auth.mode === "api-key"
        ? "API KEY PROTEGIDA"
        : "ENTORNO LOCAL";

  return (
    <header className="umbral-panel animate-fade-up rounded-2xl p-5 sm:p-7">
      {/* Top Micro Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
        <div className="flex items-center gap-3">
          <div className="lg:hidden">
            <UmbralLogo size={32} status={healthStatus} />
          </div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] tracking-[0.16em] text-[var(--ink-muted)] uppercase">
            <span className="font-semibold text-[var(--ink-primary)]">UMBRAL</span>
            <span>//</span>
            <span className="inline-flex items-center gap-1.5 text-[var(--ink-secondary)]">
              <Lock className="h-3 w-3 text-[var(--signal-vermilion)]" />
              LISTA BLANCA EXCLUSIVA ({kpis.totalSites})
              <InfoTip glossaryKey="allowlist-strict" align="left" />
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] tracking-[0.14em] uppercase">
          <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2.5 py-1 text-[var(--ink-secondary)]">
            VERCEL + CLOUDFLARE
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2.5 py-1 text-[var(--ink-muted)]">
            {authBadge}
            <InfoTip glossaryKey="auth-modes" align="right" />
          </span>
          <button
            type="button"
            onClick={onOpenGlossary}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2.5 py-1 text-[var(--ink-primary)] transition hover:border-[var(--signal-vermilion)] hover:text-[var(--signal-vermilion)]"
          >
            <BookOpen className="h-3 w-3" />
            Guía de métricas
          </button>
        </div>
      </div>

      {/* Main Editorial + Chronograph Readout */}
      <div className="mt-6 grid grid-cols-1 items-end gap-6 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3 py-1 text-[11px] font-medium text-[var(--ink-secondary)]">
            <span
              className="h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  healthStatus === "critical"
                    ? "var(--signal-crimson)"
                    : healthStatus === "warning"
                      ? "var(--signal-ochre)"
                      : "var(--signal-mint)",
              }}
            />
            {healthStatus === "critical"
              ? `${kpis.criticalIncidents} alerta(s) crítica(s) requieren acción inmediata`
              : healthStatus === "warning"
                ? `${kpis.openIncidents} incidencia(s) abierta(s) en tus dominios`
                : "Sin caídas ni alertas críticas abiertas"}
          </div>

          <h1 className="mt-3 text-3xl leading-[1.05] font-semibold tracking-[-0.03em] text-[var(--ink-primary)] sm:text-4xl lg:text-[42px]">
            {headline.main}{" "}
            <span className="font-serif-editorial font-normal italic text-[var(--ink-secondary)]">
              {headline.editorial}
            </span>
          </h1>
        </div>

        {/* Precision Swiss Chronograph Telemetry Cluster */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:col-span-6">
          <div className="umbral-inset rounded-xl p-3.5">
            <div className="flex items-center justify-between gap-1 font-mono text-[10px] tracking-[0.14em] text-[var(--ink-muted)] uppercase">
              <span>Uptime 24h</span>
              <InfoTip glossaryKey="metric-up" align="left" />
            </div>
            <div
              className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums sm:text-[26px]"
              style={{
                color:
                  kpis.globalUptime24h === null
                    ? "var(--ink-primary)"
                    : kpis.globalUptime24h >= 99.5
                      ? "var(--signal-mint)"
                      : kpis.globalUptime24h >= 97
                        ? "var(--signal-ochre)"
                        : "var(--signal-crimson)",
              }}
            >
              {kpis.globalUptime24h !== null ? `${kpis.globalUptime24h}%` : "—"}
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--ink-muted)]">Disponibilidad</div>
          </div>

          <div className="umbral-inset rounded-xl p-3.5">
            <div className="flex items-center justify-between gap-1 font-mono text-[10px] tracking-[0.14em] text-[var(--ink-muted)] uppercase">
              <span>Activas</span>
              <InfoTip glossaryKey="incident-lifecycle" />
            </div>
            <div
              className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums sm:text-[26px]"
              style={{
                color:
                  kpis.criticalIncidents > 0
                    ? "var(--signal-crimson)"
                    : kpis.openIncidents > 0
                      ? "var(--signal-ochre)"
                      : "var(--ink-primary)",
              }}
            >
              {String(kpis.openIncidents).padStart(2, "0")}
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--ink-muted)]">Incidencias</div>
          </div>

          <div className="umbral-inset rounded-xl p-3.5">
            <div className="flex items-center justify-between gap-1 font-mono text-[10px] tracking-[0.14em] text-[var(--ink-muted)] uppercase">
              <span>Perímetro</span>
              <InfoTip glossaryKey="waf-block" />
            </div>
            <div
              className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums sm:text-[26px]"
              style={{
                color:
                  kpis.securityEvents24h > 0
                    ? "var(--signal-vermilion)"
                    : "var(--ink-primary)",
              }}
            >
              {String(kpis.securityEvents24h).padStart(2, "0")}
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--ink-muted)]">Bloqueos 24h</div>
          </div>

          <div className="umbral-inset rounded-xl p-3.5">
            <div className="flex items-center justify-between gap-1 font-mono text-[10px] tracking-[0.14em] text-[var(--ink-muted)] uppercase">
              <span>Latencia</span>
              <InfoTip glossaryKey="metric-p50" align="right" />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold tracking-tight text-[var(--ink-primary)] tabular-nums sm:text-[26px]">
              {kpis.globalAvgLatencyMs !== null ? kpis.globalAvgLatencyMs : "—"}
              {kpis.globalAvgLatencyMs !== null && (
                <span className="ml-0.5 text-xs font-normal text-[var(--ink-muted)]">ms</span>
              )}
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--ink-muted)]">Media Edge</div>
          </div>
        </div>
      </div>

      {/* Bottom Scope Pills & Tactile Action Triggers */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Alcance por sitio">
          <button
            type="button"
            onClick={() => onSelectSite("all")}
            className={`rounded-lg px-3 py-1.5 font-mono text-xs transition ${
              selectedSiteId === "all"
                ? "bg-[var(--ink-primary)] font-semibold text-[var(--ink-inverse)]"
                : "border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--ink-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)]"
            }`}
          >
            TODOS ({sites.length})
          </button>

          {sites.map((site) => {
            const active = selectedSiteId === site.id;
            return (
              <button
                key={site.id}
                type="button"
                onClick={() => onSelectSite(active ? "all" : site.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-xs transition ${
                  active
                    ? "bg-[var(--ink-primary)] font-semibold text-[var(--ink-inverse)]"
                    : "border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--ink-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)]"
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: statusDotColor(site.status) }}
                />
                {site.domain}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refrescar datos (Atajo: R)"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-3.5 py-2 text-xs font-medium text-[var(--ink-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refrescar
          </button>

          <button
            type="button"
            onClick={onRunChecks}
            disabled={isRunningChecks}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
            style={{
              backgroundColor: "var(--signal-vermilion)",
              boxShadow: "0 10px 28px -10px var(--signal-vermilion)",
            }}
          >
            <Play className={`h-3.5 w-3.5 fill-current ${isRunningChecks ? "animate-pulse" : ""}`} />
            {isRunningChecks ? "Escaneando..." : "Ejecutar escaneo"}
          </button>
        </div>
      </div>
    </header>
  );
}
