import { KeyRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchIncidents,
  fetchOverview,
  fetchSecurity,
  fetchUptime,
  getSavedApiKey,
  setSavedApiKey,
  triggerManualCheck,
  UnauthorizedError,
  updateIncidentStatus,
} from "./api";
import { CommandHero } from "./components/CommandHero";
import { DomainMonoliths } from "./components/DomainMonoliths";
import { GlossaryDrawer } from "./components/GlossaryDrawer";
import { IncidentDrawer } from "./components/IncidentDrawer";
import { IncidentLedger } from "./components/IncidentLedger";
import { NavigationRail, type NavSection } from "./components/NavigationRail";
import { PerimeterIntel } from "./components/PerimeterIntel";
import { PerimeterRadar } from "./components/PerimeterRadar";
import { SetupModal } from "./components/SetupModal";
import { TelemetryWave } from "./components/TelemetryWave";
import { UmbralLogo } from "./components/UmbralLogo";
import type {
  IncidentItem,
  IncidentStatus,
  OverviewResponse,
  SecurityResponse,
  UptimePoint,
} from "./types";

const THEME_STORAGE = "umbral_theme";

export function App() {
  const [theme, setTheme] = useState<"obsidian" | "alabaster">(() => {
    const saved = localStorage.getItem(THEME_STORAGE);
    return saved === "alabaster" ? "alabaster" : "obsidian";
  });

  const [section, setSection] = useState<NavSection>("pulse");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");
  const [uptimeHours, setUptimeHours] = useState<number>(24);
  const [filters, setFilters] = useState({
    status: "active",
    category: "all",
    severity: "all",
  });

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [security, setSecurity] = useState<SecurityResponse | null>(null);
  const [uptimeChecks, setUptimeChecks] = useState<UptimePoint[]>([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningChecks, setRunningChecks] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const [authRequired, setAuthRequired] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getSavedApiKey());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_STORAGE, theme);
  }, [theme]);

  const loadAll = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      setErrorMessage(null);
      try {
        const [ov, incRes, secRes, upRes] = await Promise.all([
          fetchOverview(),
          fetchIncidents({
            siteId: selectedSiteId,
            status: filters.status,
            category: filters.category,
            severity: filters.severity,
          }),
          fetchSecurity(selectedSiteId),
          fetchUptime(selectedSiteId, uptimeHours),
        ]);
        setOverview(ov);
        setIncidents(incRes.incidents);
        setSecurity(secRes);
        setUptimeChecks(upRes.checks);
        setAuthRequired(false);
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          setAuthRequired(true);
          setErrorMessage(err.message);
        } else {
          setErrorMessage(err instanceof Error ? err.message : "Error cargando UMBRAL");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedSiteId, filters.status, filters.category, filters.severity, uptimeHours]
  );

  useEffect(() => {
    void loadAll(false);
  }, [loadAll]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadAll(true);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadAll]);

  // Atajos de teclado (ESC cierra drawer/modal, R refresca, ? abre guía de métricas)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedIncidentId(null);
        setSetupOpen(false);
        setGlossaryOpen(false);
      } else if (
        e.key === "?" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        setGlossaryOpen((v) => !v);
      } else if (
        (e.key === "r" || e.key === "R") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        void loadAll(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loadAll]);

  const selectedIncident = useMemo(
    () => incidents.find((i) => i.id === selectedIncidentId) ?? null,
    [incidents, selectedIncidentId]
  );

  const healthStatus: "healthy" | "warning" | "critical" = useMemo(() => {
    if ((overview?.kpis.criticalIncidents ?? 0) > 0) return "critical";
    if ((overview?.kpis.openIncidents ?? 0) > 0) return "warning";
    return "healthy";
  }, [overview]);

  async function handleRunChecks() {
    setRunningChecks(true);
    setToastMessage(null);
    try {
      const res = await triggerManualCheck();
      const upCount = res.uptime.filter((u) => u.ok).length;
      setToastMessage(
        `Escaneo completado (${new Date(res.ranAt).toLocaleTimeString("es-MX")}) · ${upCount}/${res.uptime.length} sitios operativos.`
      );
      await loadAll(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error ejecutando escaneo");
    } finally {
      setRunningChecks(false);
    }
  }

  async function handleUpdateIncident(id: string, status: IncidentStatus) {
    await updateIncidentStatus(id, status);
    await loadAll(true);
  }

  function handleSaveApiKey(e: React.FormEvent) {
    e.preventDefault();
    setSavedApiKey(apiKeyInput);
    void loadAll(false);
  }

  if (authRequired) {
    return (
      <div className="flex min-h-screen items-center justify-center p-5">
        <form
          onSubmit={handleSaveApiKey}
          className="umbral-panel w-full max-w-md rounded-2xl p-7 shadow-2xl"
        >
          <UmbralLogo size={42} status="warning" showWordmark />

          <div className="mt-6 flex items-center gap-2 font-mono text-[10.5px] tracking-[0.16em] text-[var(--ink-muted)] uppercase">
            <KeyRound className="h-3.5 w-3.5 text-[var(--signal-vermilion)]" />
            ACCESO RESTRINGIDO
          </div>
          <h1 className="mt-1 text-xl font-semibold text-[var(--ink-primary)]">
            Verifica tu identidad
          </h1>

          {errorMessage && (
            <p
              className="mt-3 rounded-xl p-3 text-xs"
              style={{
                backgroundColor: "var(--signal-crimson-soft)",
                color: "var(--signal-crimson)",
              }}
            >
              {errorMessage}
            </p>
          )}

          <label className="mt-4 block font-mono text-[11px] text-[var(--ink-secondary)]">
            DASHBOARD_API_KEY
          </label>
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Introduce tu clave privada..."
            className="umbral-inset mt-1.5 w-full rounded-xl px-3.5 py-2.5 font-mono text-sm text-[var(--ink-primary)] outline-none focus:border-[var(--signal-vermilion)]"
          />

          <button
            type="submit"
            className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
            style={{ backgroundColor: "var(--signal-vermilion)" }}
          >
            Entrar a UMBRAL
          </button>

          <p className="mt-3 text-[11px] leading-relaxed text-[var(--ink-muted)]">
            En producción se recomienda Cloudflare Access (Zero Trust) para autenticar directamente
            con tu correo antes de cargar la interfaz.
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 lg:pb-12 lg:pl-[78px]">
      <NavigationRail
        active={section}
        onSelect={setSection}
        openIncidentsCount={overview?.kpis.openIncidents ?? 0}
        healthStatus={healthStatus}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "obsidian" ? "alabaster" : "obsidian"))}
        onOpenSetup={() => setSetupOpen(true)}
        onOpenGlossary={() => setGlossaryOpen(true)}
      />

      <main className="mx-auto max-w-[1360px] space-y-6 px-4 pt-5 sm:px-7 sm:pt-7">
        {toastMessage && (
          <div className="umbral-panel animate-fade-up flex items-center justify-between rounded-xl px-4 py-2.5 font-mono text-xs text-[var(--ink-primary)]">
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
            >
              ✕
            </button>
          </div>
        )}

        {errorMessage && (
          <div
            className="rounded-xl border px-4 py-2.5 font-mono text-xs"
            style={{
              backgroundColor: "var(--signal-crimson-soft)",
              borderColor: "var(--signal-crimson)",
              color: "var(--signal-crimson)",
            }}
          >
            {errorMessage}
          </div>
        )}

        {loading || !overview ? (
          <div className="space-y-4">
            <div className="umbral-panel h-56 animate-pulse rounded-2xl" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="umbral-panel h-72 animate-pulse rounded-2xl lg:col-span-8" />
              <div className="umbral-panel h-72 animate-pulse rounded-2xl lg:col-span-4" />
            </div>
          </div>
        ) : (
          <>
            <CommandHero
              overview={overview}
              selectedSiteId={selectedSiteId}
              onSelectSite={setSelectedSiteId}
              onRefresh={() => void loadAll(false)}
              onRunChecks={() => void handleRunChecks()}
              onOpenGlossary={() => setGlossaryOpen(true)}
              isRefreshing={refreshing}
              isRunningChecks={runningChecks}
              healthStatus={healthStatus}
            />

            {section === "pulse" && (
              <div className="space-y-6">
                {/* Asymmetric 12-col Bento Stage */}
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                  <div className="xl:col-span-8">
                    <DomainMonoliths
                      sites={overview.sites}
                      selectedSiteId={selectedSiteId}
                      onSelectSite={setSelectedSiteId}
                    />
                  </div>
                  <div className="xl:col-span-4">
                    <PerimeterRadar overview={overview} incidents={incidents} />
                  </div>
                </div>

                <IncidentLedger
                  incidents={incidents}
                  sites={overview.sites}
                  filters={filters}
                  onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
                  onSelectIncident={(inc) => setSelectedIncidentId(inc.id)}
                />

                <TelemetryWave
                  checks={uptimeChecks}
                  sites={overview.sites}
                  hours={uptimeHours}
                  onChangeHours={setUptimeHours}
                />
              </div>
            )}

            {section === "incidents" && (
              <IncidentLedger
                incidents={incidents}
                sites={overview.sites}
                filters={filters}
                onFilterChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
                onSelectIncident={(inc) => setSelectedIncidentId(inc.id)}
              />
            )}

            {section === "perimeter" && (
              <PerimeterIntel security={security} sites={overview.sites} />
            )}

            {section === "telemetry" && (
              <div className="space-y-6">
                <TelemetryWave
                  checks={uptimeChecks}
                  sites={overview.sites}
                  hours={uptimeHours}
                  onChangeHours={setUptimeHours}
                />
                <DomainMonoliths
                  sites={overview.sites}
                  selectedSiteId={selectedSiteId}
                  onSelectSite={setSelectedSiteId}
                />
              </div>
            )}
          </>
        )}
      </main>

      <IncidentDrawer
        incident={selectedIncident}
        site={overview?.sites.find((s) => s.id === selectedIncident?.site_id)}
        onClose={() => setSelectedIncidentId(null)}
        onUpdateStatus={handleUpdateIncident}
      />

      <SetupModal open={setupOpen} overview={overview} onClose={() => setSetupOpen(false)} />
      <GlossaryDrawer open={glossaryOpen} onClose={() => setGlossaryOpen(false)} />
    </div>
  );
}
