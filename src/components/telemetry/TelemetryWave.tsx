/**
 * ============================================================================
 * Componente de Telemetría — `TelemetryWave`
 * ============================================================================
 * Gráfica de latencia histórica (6h, 24h, 72h) y cálculo de percentiles
 * estadísticos (`P50`, `P95`, `Pico Máximo` y conteo de fallos).
 */

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SiteSummary, UptimePoint } from "../../types/dashboard.types";
import { computePercentile } from "../../utils/math";
import { InfoTip } from "../ui/InfoTip";

interface TelemetryWaveProps {
  checks: UptimePoint[];
  sites: SiteSummary[];
  hours: number;
  onChangeHours: (hours: number) => void;
}

export function TelemetryWave({ checks, sites, hours, onChangeHours }: TelemetryWaveProps) {
  const siteNameMap = new Map(sites.map((s) => [s.id, s.name]));

  const okLatencies = checks
    .filter((c) => c.ok === 1)
    .map((c) => c.latency_ms)
    .sort((a, b) => a - b);

  const p50 = computePercentile(okLatencies, 50);
  const p95 = computePercentile(okLatencies, 95);
  const maxMs = okLatencies.length ? okLatencies[okLatencies.length - 1] : null;
  const failedCount = checks.filter((c) => c.ok === 0).length;

  const data = checks.map((pt) => ({
    time: new Date(pt.checked_at).toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    latencyMs: pt.latency_ms,
    ok: pt.ok === 1,
    statusCode: pt.status_code,
    siteName: siteNameMap.get(pt.site_id) ?? pt.site_id,
  }));

  return (
    <section className="umbral-panel animate-fade-up rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] tracking-[0.18em] text-[var(--ink-muted)] uppercase">
            04 // TELEMETRÍA DE RESPUESTA
          </span>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[var(--ink-primary)]">
            Curva de Latencia Edge → Vercel
          </h2>
        </div>

        <div className="umbral-inset flex items-center gap-1 rounded-xl p-1 font-mono text-[11px]">
          {[6, 24, 72].map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => onChangeHours(h)}
              className={`rounded-lg px-3 py-1 transition ${
                hours === h
                  ? "bg-[var(--ink-primary)] font-semibold text-[var(--ink-inverse)]"
                  : "text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
              }`}
            >
              {h}H
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="umbral-inset rounded-xl px-3.5 py-2.5">
          <div className="flex items-center justify-between font-mono text-[9.5px] tracking-wider text-[var(--ink-muted)] uppercase">
            <span>P50 Mediana</span>
            <InfoTip glossaryKey="metric-p50" align="left" />
          </div>
          <div className="mt-1 font-mono text-base font-semibold text-[var(--ink-primary)] tabular-nums">
            {p50 !== null ? `${p50} ms` : "—"}
          </div>
        </div>

        <div className="umbral-inset rounded-xl px-3.5 py-2.5">
          <div className="flex items-center justify-between font-mono text-[9.5px] tracking-wider text-[var(--ink-muted)] uppercase">
            <span>P95 Percentil</span>
            <InfoTip glossaryKey="metric-p95" />
          </div>
          <div className="mt-1 font-mono text-base font-semibold text-[var(--signal-ochre)] tabular-nums">
            {p95 !== null ? `${p95} ms` : "—"}
          </div>
        </div>

        <div className="umbral-inset rounded-xl px-3.5 py-2.5">
          <div className="flex items-center justify-between font-mono text-[9.5px] tracking-wider text-[var(--ink-muted)] uppercase">
            <span>Pico Máximo</span>
            <InfoTip glossaryKey="metric-max-fails" />
          </div>
          <div className="mt-1 font-mono text-base font-semibold text-[var(--ink-primary)] tabular-nums">
            {maxMs !== null ? `${maxMs} ms` : "—"}
          </div>
        </div>

        <div className="umbral-inset rounded-xl px-3.5 py-2.5">
          <div className="flex items-center justify-between font-mono text-[9.5px] tracking-wider text-[var(--ink-muted)] uppercase">
            <span>Fallos ({hours}h)</span>
            <InfoTip glossaryKey="cf-52x" align="right" />
          </div>
          <div
            className="mt-1 font-mono text-base font-semibold tabular-nums"
            style={{ color: failedCount > 0 ? "var(--signal-crimson)" : "var(--signal-mint)" }}
          >
            {failedCount}
          </div>
        </div>
      </div>

      <div className="mt-5">
        {data.length === 0 ? (
          <div className="umbral-inset flex h-60 items-center justify-center rounded-xl text-xs text-[var(--ink-muted)]">
            Sin muestras de telemetría en las últimas {hours}h. Pulsa &ldquo;Ejecutar escaneo&rdquo;.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="umbralWaveFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF5428" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="#FF5428" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 6" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="var(--ink-muted)"
                  tick={{ fontSize: 10.5, fontFamily: "var(--font-mono)" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={28}
                />
                <YAxis
                  stroke="var(--ink-muted)"
                  tick={{ fontSize: 10.5, fontFamily: "var(--font-mono)" }}
                  tickLine={false}
                  axisLine={false}
                  unit="ms"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "12px",
                    fontSize: "11.5px",
                    fontFamily: "var(--font-mono)",
                    color: "var(--ink-primary)",
                  }}
                  formatter={(value, _name, item) => {
                    const p = item.payload as (typeof data)[number] | undefined;
                    return [
                      `${value ?? "—"} ms · HTTP ${p?.statusCode ?? "ERR"} (${p?.siteName ?? ""})`,
                      p?.ok ? "OK" : "FALLO",
                    ];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="latencyMs"
                  stroke="#FF5428"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#umbralWaveFill)"
                  activeDot={{ r: 4, fill: "#FF5428", stroke: "var(--bg-canvas)", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
