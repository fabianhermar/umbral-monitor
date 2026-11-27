/**
 * ============================================================================
 * Componente Raíz — `App`
 * ============================================================================
 * Orquesta únicamente la navegación de vistas y modales apoyándose en hooks
 * dedicados (`useTheme`, `useDashboardData`, `useKeyboardShortcuts`).
 */

import { useCallback, useMemo, useState } from "react";
import { DemoShowcaseBar } from "./components/demo/DemoShowcaseBar";
import { IncidentDrawer } from "./components/incidents/IncidentDrawer";
import { IncidentLedger } from "./components/incidents/IncidentLedger";
import { AuthGate } from "./components/layout/AuthGate";
import { CommandHero } from "./components/layout/CommandHero";
import { NavigationRail } from "./components/layout/NavigationRail";
import { GlossaryDrawer } from "./components/modals/GlossaryDrawer";
import { SetupModal } from "./components/modals/SetupModal";
import { DomainMonoliths } from "./components/overview/DomainMonoliths";
import { PerimeterRadar } from "./components/overview/PerimeterRadar";
import { PerimeterIntel } from "./components/perimeter/PerimeterIntel";
import { TelemetryWave } from "./components/telemetry/TelemetryWave";
import { useDashboardData } from "./hooks/useDashboardData";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useTheme } from "./hooks/useTheme";
import type { NavSection } from "./types/dashboard.types";

export function App() {
  const { theme, toggleTheme } = useTheme();
  const data = useDashboardData();

  const [section, setSection] = useState<NavSection>("pulse");
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [glossaryOpen, setGlossaryOpen] = useState(false);

  const closeOverlays = useCallback(() => {
    setSelectedIncidentId(null);
    setSetupOpen(false);
    setGlossaryOpen(false);
  }, []);

  const toggleGlossary = useCallback(() => {
    setGlossaryOpen((v) => !v);
  }, []);

  useKeyboardShortcuts({
    onEscape: closeOverlays,
    onToggleGlossary: toggleGlossary,
    onRefresh: data.refresh,
  });

  const selectedIncident = useMemo(
    () => data.incidents.find((i) => i.id === selectedIncidentId) ?? null,
    [data.incidents, selectedIncidentId]
  );

  if (data.authRequired) {
    return (
      <AuthGate
        errorMessage={data.errorMessage}
        onSubmitKey={data.loginWithApiKey}
      />
    );
  }

  return (
    <div className="min-h-screen pb-24 lg:pb-12 lg:pl-[78px]">
      <NavigationRail
        active={section}
        onSelect={setSection}
        openIncidentsCount={data.overview?.kpis.openIncidents ?? 0}
        healthStatus={data.healthStatus}
        theme={theme}
        authMode={data.overview?.auth.mode}
        onToggleTheme={toggleTheme}
        onOpenSetup={() => setSetupOpen(true)}
        onOpenGlossary={() => setGlossaryOpen(true)}
        onLogout={data.logoutApiKey}
      />

      <main className="mx-auto max-w-[1360px] space-y-6 px-4 pt-5 sm:px-7 sm:pt-7">
        {data.toastMessage && (
          <div className="umbral-panel animate-fade-up flex items-center justify-between rounded-xl px-4 py-2.5 font-mono text-xs text-[var(--ink-primary)]">
            <span>{data.toastMessage}</span>
            <button
              type="button"
              onClick={() => data.setToastMessage(null)}
              className="text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
            >
              ✕
            </button>
          </div>
        )}

        {data.errorMessage && (
          <div
            className="rounded-xl border px-4 py-2.5 font-mono text-xs"
            style={{
              backgroundColor: "var(--signal-crimson-soft)",
              borderColor: "var(--signal-crimson)",
              color: "var(--signal-crimson)",
            }}
          >
            {data.errorMessage}
          </div>
        )}

        {data.loading || !data.overview ? (
          <div className="space-y-4">
            <div className="umbral-panel h-56 animate-pulse rounded-2xl" />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="umbral-panel h-72 animate-pulse rounded-2xl lg:col-span-8" />
              <div className="umbral-panel h-72 animate-pulse rounded-2xl lg:col-span-4" />
            </div>
          </div>
        ) : (
          <>
            {data.overview.isDemo && (
              <DemoShowcaseBar onRefreshDashboard={data.refresh} />
            )}

            <CommandHero
              overview={data.overview}
              selectedSiteId={data.selectedSiteId}
              onSelectSite={data.setSelectedSiteId}
              onRefresh={data.refresh}
              onRunChecks={() => void data.runManualScan()}
              onOpenGlossary={() => setGlossaryOpen(true)}
              isRefreshing={data.refreshing}
              isRunningChecks={data.runningChecks}
              healthStatus={data.healthStatus}
            />

            {section === "pulse" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                  <div className="xl:col-span-8">
                    <DomainMonoliths
                      sites={data.overview.sites}
                      selectedSiteId={data.selectedSiteId}
                      onSelectSite={data.setSelectedSiteId}
                    />
                  </div>
                  <div className="xl:col-span-4">
                    <PerimeterRadar overview={data.overview} incidents={data.incidents} />
                  </div>
                </div>

                <IncidentLedger
                  incidents={data.incidents}
                  sites={data.overview.sites}
                  filters={data.filters}
                  onFilterChange={data.patchFilters}
                  onSelectIncident={(inc) => setSelectedIncidentId(inc.id)}
                />

                <TelemetryWave
                  checks={data.uptimeChecks}
                  sites={data.overview.sites}
                  hours={data.uptimeHours}
                  onChangeHours={data.setUptimeHours}
                />
              </div>
            )}

            {section === "incidents" && (
              <IncidentLedger
                incidents={data.incidents}
                sites={data.overview.sites}
                filters={data.filters}
                onFilterChange={data.patchFilters}
                onSelectIncident={(inc) => setSelectedIncidentId(inc.id)}
              />
            )}

            {section === "perimeter" && (
              <PerimeterIntel security={data.security} sites={data.overview.sites} />
            )}

            {section === "telemetry" && (
              <div className="space-y-6">
                <TelemetryWave
                  checks={data.uptimeChecks}
                  sites={data.overview.sites}
                  hours={data.uptimeHours}
                  onChangeHours={data.setUptimeHours}
                />
                <DomainMonoliths
                  sites={data.overview.sites}
                  selectedSiteId={data.selectedSiteId}
                  onSelectSite={data.setSelectedSiteId}
                />
              </div>
            )}
          </>
        )}
      </main>

      <IncidentDrawer
        incident={selectedIncident}
        site={data.overview?.sites.find((s) => s.id === selectedIncident?.site_id)}
        onClose={() => setSelectedIncidentId(null)}
        onUpdateStatus={data.changeIncidentStatus}
      />

      <SetupModal
        open={setupOpen}
        overview={data.overview}
        onClose={() => setSetupOpen(false)}
      />

      <GlossaryDrawer
        open={glossaryOpen}
        onClose={() => setGlossaryOpen(false)}
      />
    </div>
  );
}
