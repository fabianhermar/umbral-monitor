/**
 * ============================================================================
 * Componente de Seguridad — `PerimeterIntel`
 * ============================================================================
 * Inteligencia de perímetro (24h): barras proporcionales de Top IPs mitigadas,
 * acciones WAF/SDK, rutas atacadas y bitácora detallada de eventos en D1.
 */

import { Globe2, ShieldBan, Terminal } from "lucide-react";
import { useState } from "react";
import type { SecurityResponse, SiteSummary } from "../../types/dashboard.types";
import { InfoTip } from "../ui/InfoTip";

interface PerimeterIntelProps {
  security: SecurityResponse | null;
  sites: SiteSummary[];
}

function getActionColors(action: string): { color: string; bg: string } {
  if (action === "block") {
    return { color: "var(--signal-crimson)", bg: "var(--signal-crimson-soft)" };
  }
  if (action === "rate_limit") {
    return { color: "var(--signal-vermilion)", bg: "var(--signal-vermilion-soft)" };
  }
  if (action.includes("challenge")) {
    return { color: "var(--signal-ochre)", bg: "var(--signal-ochre-soft)" };
  }
  return { color: "var(--signal-cobalt)", bg: "var(--signal-cobalt-soft)" };
}

export function PerimeterIntel({ security, sites }: PerimeterIntelProps) {
  const [actionFilter, setActionFilter] = useState<string>("all");
  const siteMap = new Map(sites.map((s) => [s.id, s.domain]));

  if (!security) return null;

  const maxIp = Math.max(1, ...security.topIps.map((i) => i.count));
  const maxAction = Math.max(1, ...security.actionsBreakdown.map((a) => a.count));
  const maxPath = Math.max(1, ...security.topPaths.map((p) => p.count));

  const filteredEvents =
    actionFilter === "all"
      ? security.events
      : security.events.filter((ev) => ev.action === actionFilter);

  const availableActions = Array.from(new Set(security.events.map((e) => e.action)));

  return (
    <div className="animate-fade-up space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="umbral-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.16em] text-[var(--ink-muted)] uppercase">
              <Globe2 className="h-4 w-4 text-[var(--signal-vermilion)]" />
              Top IPs Mitigadas
            </div>
            <span className="font-mono text-[10px] text-[var(--ink-muted)]">24H</span>
          </div>

          {security.topIps.length === 0 ? (
            <p className="mt-6 text-xs text-[var(--ink-muted)]">Sin IPs bloqueadas en 24h.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {security.topIps.map((item) => (
                <div key={`${item.ip}-${item.country}`} className="space-y-1">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-[var(--ink-primary)]">
                      {item.ip}{" "}
                      {item.country && (
                        <span className="ml-1 rounded bg-[var(--bg-inset)] px-1.5 py-0.5 text-[10px] text-[var(--ink-muted)]">
                          {item.country}
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-[var(--signal-vermilion)]">
                      {item.count}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-inset)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(10, (item.count / maxIp) * 100)}%`,
                        backgroundColor: "var(--signal-vermilion)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="umbral-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.16em] text-[var(--ink-muted)] uppercase">
              <ShieldBan className="h-4 w-4 text-[var(--signal-ochre)]" />
              Acciones de Defensa
              <InfoTip glossaryKey="waf-challenge" />
            </div>
            <span className="font-mono text-[10px] text-[var(--ink-muted)]">WAF / SDK</span>
          </div>

          {security.actionsBreakdown.length === 0 ? (
            <p className="mt-6 text-xs text-[var(--ink-muted)]">Sin acciones registradas.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {security.actionsBreakdown.map((item) => {
                const st = getActionColors(item.action);
                return (
                  <div key={item.action} className="space-y-1">
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span
                        className="rounded px-2 py-0.5 text-[11px] font-medium"
                        style={{ color: st.color, backgroundColor: st.bg }}
                      >
                        {item.action}
                      </span>
                      <span className="font-semibold text-[var(--ink-primary)]">{item.count}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-inset)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(10, (item.count / maxAction) * 100)}%`,
                          backgroundColor: st.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="umbral-panel rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-[10.5px] tracking-[0.16em] text-[var(--ink-muted)] uppercase">
              <Terminal className="h-4 w-4 text-[var(--signal-cobalt)]" />
              Rutas Objetivo
            </div>
            <span className="font-mono text-[10px] text-[var(--ink-muted)]">TOP PATHS</span>
          </div>

          {security.topPaths.length === 0 ? (
            <p className="mt-6 text-xs text-[var(--ink-muted)]">Sin rutas objetivo en 24h.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {security.topPaths.map((item) => (
                <div key={item.path} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 font-mono text-xs">
                    <span className="truncate text-[var(--ink-primary)]">{item.path}</span>
                    <span className="shrink-0 font-semibold text-[var(--signal-cobalt)]">
                      {item.count}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-inset)]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(10, (item.count / maxPath) * 100)}%`,
                        backgroundColor: "var(--signal-cobalt)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="umbral-panel overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] p-5">
          <div>
            <span className="font-mono text-[10px] tracking-[0.18em] text-[var(--ink-muted)] uppercase">
              03 // BITÁCORA PERIMETRAL D1
            </span>
            <h3 className="mt-0.5 text-base font-semibold text-[var(--ink-primary)]">
              Eventos de Firewall, Bots y Rate Limiting
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActionFilter("all")}
              className={`rounded-lg px-2.5 py-1 font-mono text-[11px] transition ${
                actionFilter === "all"
                  ? "bg-[var(--ink-primary)] font-semibold text-[var(--ink-inverse)]"
                  : "border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--ink-secondary)]"
              }`}
            >
              Todos ({security.events.length})
            </button>
            {availableActions.map((act) => (
              <button
                key={act}
                type="button"
                onClick={() => setActionFilter(act)}
                className={`rounded-lg px-2.5 py-1 font-mono text-[11px] transition ${
                  actionFilter === act
                    ? "bg-[var(--ink-primary)] font-semibold text-[var(--ink-inverse)]"
                    : "border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--ink-secondary)]"
                }`}
              >
                {act}
              </button>
            ))}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="p-10 text-center text-xs text-[var(--ink-muted)]">
            No hay eventos perimetrales registrados para este filtro.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[10px] tracking-wider text-[var(--ink-muted)] uppercase">
                <tr>
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-4 py-3">Host</th>
                  <th className="px-4 py-3">Acción</th>
                  <th className="px-4 py-3">Origen</th>
                  <th className="px-4 py-3">Petición</th>
                  <th className="px-5 py-3">Regla</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredEvents.map((ev) => {
                  const st = getActionColors(ev.action);
                  return (
                    <tr key={ev.id} className="transition hover:bg-[var(--bg-surface-hover)]">
                      <td className="whitespace-nowrap px-5 py-3 text-[var(--ink-muted)]">
                        {new Date(ev.occurred_at).toLocaleString("es-MX")}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-primary)]">
                        {ev.host ?? siteMap.get(ev.site_id) ?? ev.site_id}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className="rounded px-2 py-0.5 text-[10.5px] font-semibold"
                          style={{ color: st.color, backgroundColor: st.bg }}
                        >
                          {ev.action}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--ink-secondary)]">
                        {ev.client_ip ?? "—"}
                        {ev.country ? ` · ${ev.country}` : ""}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-[var(--ink-primary)]">
                        <span className="text-[var(--ink-muted)]">{ev.method ?? "REQ"} </span>
                        {ev.path ?? "/"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-[var(--ink-muted)]">
                        {ev.rule_source ?? ev.source}
                        {ev.rule_id ? ` / ${ev.rule_id}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
