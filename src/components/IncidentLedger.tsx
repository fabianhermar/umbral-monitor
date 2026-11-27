import {
  AlertOctagon,
  Ban,
  Bug,
  CheckCircle2,
  ChevronRight,
  Flame,
  Rocket,
  ShieldAlert,
  WifiOff,
} from "lucide-react";
import type {
  IncidentCategory,
  IncidentItem,
  IncidentSeverity,
  IncidentStatus,
  SiteSummary,
} from "../types";
import { InfoTip } from "./InfoTip";

interface IncidentLedgerProps {
  incidents: IncidentItem[];
  sites: SiteSummary[];
  filters: {
    status: string;
    category: string;
    severity: string;
  };
  onFilterChange: (patch: Partial<{ status: string; category: string; severity: string }>) => void;
  onSelectIncident: (incident: IncidentItem) => void;
}

const CATEGORY_META: Record<
  IncidentCategory,
  { label: string; icon: typeof WifiOff; color: string }
> = {
  downtime: { label: "CAÍDA", icon: WifiOff, color: "var(--signal-crimson)" },
  attack: { label: "ATAQUE", icon: Flame, color: "var(--signal-vermilion)" },
  block: { label: "BLOQUEO", icon: Ban, color: "var(--signal-ochre)" },
  security: { label: "SEGURIDAD", icon: ShieldAlert, color: "var(--signal-cobalt)" },
  error: { label: "ERROR APP", icon: Bug, color: "#e879f9" },
  deployment: { label: "DEPLOY", icon: Rocket, color: "var(--signal-mint)" },
};

const SEVERITY_COLOR: Record<IncidentSeverity, { label: string; color: string; bg: string }> = {
  critical: { label: "CRÍTICA", color: "var(--signal-crimson)", bg: "var(--signal-crimson-soft)" },
  high: { label: "ALTA", color: "var(--signal-vermilion)", bg: "var(--signal-vermilion-soft)" },
  medium: { label: "MEDIA", color: "var(--signal-ochre)", bg: "var(--signal-ochre-soft)" },
  low: { label: "BAJA", color: "var(--ink-secondary)", bg: "var(--bg-inset)" },
};

const STATUS_META: Record<IncidentStatus, { label: string; color: string }> = {
  open: { label: "Abierta", color: "var(--signal-crimson)" },
  investigating: { label: "Investigando", color: "var(--signal-ochre)" },
  resolved: { label: "Resuelta", color: "var(--signal-mint)" },
};

export function IncidentLedger({
  incidents,
  sites,
  filters,
  onFilterChange,
  onSelectIncident,
}: IncidentLedgerProps) {
  const siteMap = new Map(sites.map((s) => [s.id, s]));

  const statusTabs = [
    { id: "active", label: "Activas" },
    { id: "open", label: "Abiertas" },
    { id: "investigating", label: "Investigando" },
    { id: "resolved", label: "Resueltas" },
    { id: "all", label: "Todas" },
  ];

  return (
    <section className="umbral-panel animate-fade-up overflow-hidden rounded-2xl">
      {/* Header & Filter Pills */}
      <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="font-mono text-[10px] tracking-[0.18em] text-[var(--ink-muted)] uppercase">
              02 // LIBRO DE INCIDENCIAS
            </span>
            <h2 className="mt-0.5 flex items-center gap-1.5 text-base font-semibold tracking-tight text-[var(--ink-primary)]">
              Flujo Unificado de Eventos Críticos
              <InfoTip glossaryKey="occurrences-fingerprint" align="left" size="sm" />
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtrar por categoría"
              value={filters.category}
              onChange={(e) => onFilterChange({ category: e.target.value })}
              className="umbral-inset rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-[var(--ink-primary)] outline-none focus:border-[var(--border-strong)]"
            >
              <option value="all">Categoría: Todas</option>
              <option value="downtime">Caídas</option>
              <option value="attack">Ataques</option>
              <option value="block">Bloqueos</option>
              <option value="security">Seguridad</option>
              <option value="error">Errores App</option>
              <option value="deployment">Despliegues</option>
            </select>

            <select
              aria-label="Filtrar por severidad"
              value={filters.severity}
              onChange={(e) => onFilterChange({ severity: e.target.value })}
              className="umbral-inset rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-[var(--ink-primary)] outline-none focus:border-[var(--border-strong)]"
            >
              <option value="all">Severidad: Todas</option>
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
          </div>
        </div>

        {/* Status Segmented Bar */}
        <div className="flex flex-wrap items-center gap-1.5">
          {statusTabs.map((t) => {
            const active = filters.status === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onFilterChange({ status: t.id })}
                className={`rounded-lg px-3 py-1 font-mono text-[11px] transition ${
                  active
                    ? "bg-[var(--ink-primary)] font-semibold text-[var(--ink-inverse)]"
                    : "border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Incident Stream */}
      {incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--signal-mint-soft)] text-[var(--signal-mint)]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-[var(--ink-primary)]">
            Sin incidencias en este filtro
          </h3>
          <p className="mt-1 max-w-sm text-xs text-[var(--ink-muted)]">
            Tus dominios propios no presentan alertas coincidentes en este momento.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {incidents.map((inc) => {
            const cat = CATEGORY_META[inc.category] ?? {
              label: inc.category.toUpperCase(),
              icon: AlertOctagon,
              color: "var(--ink-secondary)",
            };
            const CatIcon = cat.icon;
            const sev = SEVERITY_COLOR[inc.severity] ?? SEVERITY_COLOR.low;
            const st = STATUS_META[inc.status] ?? STATUS_META.open;
            const site = siteMap.get(inc.site_id);

            return (
              <button
                key={inc.id}
                type="button"
                onClick={() => onSelectIncident(inc)}
                className="group relative flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-[var(--bg-surface-hover)]"
              >
                {/* Left Severity Spine */}
                <span
                  className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full"
                  style={{ backgroundColor: sev.color }}
                />

                {/* Category Emblem */}
                <div
                  className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] sm:flex"
                  style={{ color: cat.color }}
                >
                  <CatIcon className="h-[18px] w-[18px]" />
                </div>

                {/* Main Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
                    <span className="font-semibold tracking-wider" style={{ color: cat.color }}>
                      {cat.label}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 font-semibold"
                      style={{ color: sev.color, backgroundColor: sev.bg }}
                    >
                      {sev.label}
                    </span>
                    <span className="rounded border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2 py-0.5 text-[var(--ink-secondary)]">
                      {site?.domain ?? inc.site_id}
                    </span>
                    {inc.occurrences > 1 && (
                      <span className="rounded bg-[var(--signal-vermilion-soft)] px-1.5 py-0.5 font-bold text-[var(--signal-vermilion)]">
                        ×{inc.occurrences}
                      </span>
                    )}
                  </div>

                  <div className="mt-1.5 truncate text-sm font-semibold text-[var(--ink-primary)] group-hover:text-[var(--signal-vermilion)]">
                    {inc.title}
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-xs text-[var(--ink-secondary)]">
                    {inc.description}
                  </p>
                </div>

                {/* Right Status + Timestamp */}
                <div className="hidden shrink-0 text-right sm:block">
                  <div className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: st.color }}
                    />
                    <span style={{ color: st.color }}>{st.label}</span>
                  </div>
                  <div className="mt-1 font-mono text-[10.5px] text-[var(--ink-muted)]">
                    {new Date(inc.last_seen_at).toLocaleTimeString("es-MX", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {inc.source}
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ink-primary)]" />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
