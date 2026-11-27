/**
 * ============================================================================
 * Componente de Vista General — `PerimeterRadar`
 * ============================================================================
 * Brújula concéntrica en SVG con 3 arcos ponderados (`UP`, `HDR`, `DEF`) y
 * matriz proporcional de incidencias activas por categoría.
 */

import type {
  IncidentCategory,
  IncidentItem,
  OverviewResponse,
} from "../../types/dashboard.types";
import { computeSvgArcDash } from "../../utils/math";
import { InfoTip } from "../ui/InfoTip";

interface PerimeterRadarProps {
  overview: OverviewResponse;
  incidents: IncidentItem[];
}

const CATEGORIES: Array<{ id: IncidentCategory; label: string; color: string }> = [
  { id: "downtime", label: "Caídas", color: "var(--signal-crimson)" },
  { id: "attack", label: "Ataques", color: "var(--signal-vermilion)" },
  { id: "block", label: "Bloqueos", color: "var(--signal-ochre)" },
  { id: "security", label: "Seguridad", color: "var(--signal-cobalt)" },
  { id: "error", label: "Errores App", color: "#e879f9" },
  { id: "deployment", label: "Deploys", color: "var(--signal-mint)" },
];

export function PerimeterRadar({ overview, incidents }: PerimeterRadarProps) {
  const uptimeScore = overview.kpis.globalUptime24h ?? 100;
  const avgSecScore =
    overview.sites.length > 0
      ? Math.round(
          overview.sites.reduce((acc, s) => acc + s.securityScore, 0) / overview.sites.length
        )
      : 100;

  const activeIncidents = incidents.filter((i) => i.status !== "resolved");
  const stabilityPenalty = Math.min(
    65,
    overview.kpis.criticalIncidents * 28 +
      Math.max(0, overview.kpis.openIncidents - overview.kpis.criticalIncidents) * 8
  );
  const calmScore = Math.max(15, 100 - stabilityPenalty);
  const perimeterIndex = Math.round(uptimeScore * 0.45 + avgSecScore * 0.25 + calmScore * 0.3);

  const outerArc = computeSvgArcDash(uptimeScore, 78);
  const midArc = computeSvgArcDash(avgSecScore, 62);
  const innerArc = computeSvgArcDash(calmScore, 46);

  const countsByCategory = new Map<IncidentCategory, number>();
  for (const inc of activeIncidents) {
    countsByCategory.set(inc.category, (countsByCategory.get(inc.category) ?? 0) + 1);
  }
  const maxCategoryCount = Math.max(1, ...Array.from(countsByCategory.values()));

  return (
    <section className="umbral-panel animate-fade-up flex flex-col justify-between rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-[10px] tracking-[0.18em] text-[var(--ink-muted)] uppercase">
            INDICE // PERÍMETRO
          </span>
          <h2 className="mt-0.5 flex items-center gap-1.5 text-base font-semibold tracking-tight text-[var(--ink-primary)]">
            Brújula de Salud
            <InfoTip glossaryKey="perimeter-score" align="left" size="sm" />
          </h2>
        </div>
        <span className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-inset)] px-2 py-0.5 font-mono text-[10px] text-[var(--ink-secondary)]">
          24H LIVE
        </span>
      </div>

      <div className="my-4 flex items-center justify-center">
        <div className="relative h-48 w-48">
          <svg viewBox="0 0 184 184" className="h-full w-full -rotate-90">
            <circle cx="92" cy="92" r="78" fill="none" stroke="var(--border-subtle)" strokeWidth="6" />
            <circle cx="92" cy="92" r="62" fill="none" stroke="var(--border-subtle)" strokeWidth="6" />
            <circle cx="92" cy="92" r="46" fill="none" stroke="var(--border-subtle)" strokeWidth="6" />

            <circle
              cx="92"
              cy="92"
              r="78"
              fill="none"
              stroke="var(--signal-mint)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={outerArc.circumference}
              strokeDashoffset={outerArc.offset}
              className="transition-all duration-700"
            />
            <circle
              cx="92"
              cy="92"
              r="62"
              fill="none"
              stroke="var(--signal-cobalt)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={midArc.circumference}
              strokeDashoffset={midArc.offset}
              className="transition-all duration-700"
            />
            <circle
              cx="92"
              cy="92"
              r="46"
              fill="none"
              stroke="var(--signal-vermilion)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={innerArc.circumference}
              strokeDashoffset={innerArc.offset}
              className="transition-all duration-700"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-mono text-3xl font-bold tracking-tight text-[var(--ink-primary)] tabular-nums">
              {perimeterIndex}
            </span>
            <span className="font-mono text-[9.5px] tracking-[0.18em] text-[var(--ink-muted)] uppercase">
              SCORE / 100
            </span>
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 border-y border-[var(--border-subtle)] py-2.5 text-center font-mono text-[10px]">
        <div>
          <div className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--signal-mint)]" />
            <span className="text-[var(--ink-muted)]">UP</span>
            <InfoTip glossaryKey="metric-up" align="left" />
          </div>
          <div className="mt-0.5 font-semibold text-[var(--ink-primary)]">{uptimeScore}%</div>
        </div>
        <div>
          <div className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--signal-cobalt)]" />
            <span className="text-[var(--ink-muted)]">HDR</span>
            <InfoTip glossaryKey="metric-hdr" />
          </div>
          <div className="mt-0.5 font-semibold text-[var(--ink-primary)]">{avgSecScore}%</div>
        </div>
        <div>
          <div className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--signal-vermilion)]" />
            <span className="text-[var(--ink-muted)]">DEF</span>
            <InfoTip glossaryKey="metric-def" align="right" />
          </div>
          <div className="mt-0.5 font-semibold text-[var(--ink-primary)]">{calmScore}%</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.14em] text-[var(--ink-muted)] uppercase">
          <span>Matriz de incidencias activas</span>
          <span>{activeIncidents.length} total</span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {CATEGORIES.map((cat) => {
            const count = countsByCategory.get(cat.id) ?? 0;
            const widthPct = count > 0 ? Math.max(14, (count / maxCategoryCount) * 100) : 0;
            return (
              <div key={cat.id} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--ink-secondary)]">{cat.label}</span>
                  <span className="font-mono font-semibold text-[var(--ink-primary)]">{count}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-inset)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${widthPct}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
