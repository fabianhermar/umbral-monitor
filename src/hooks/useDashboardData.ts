/**
 * ============================================================================
 * Hook `useDashboardData` — Estado, Sincronización y Acciones de Datos
 * ============================================================================
 * Separa completamente la lógica de red, refresco automático (60s), manejo de
 * sesión y filtros respecto de los componentes visuales de React.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AUTO_REFRESH_INTERVAL_MS } from "../constants/storage";
import {
  clearSavedApiKey,
  fetchIncidents,
  fetchOverview,
  fetchSecurity,
  fetchUptime,
  setSavedApiKey,
  triggerManualCheck,
  UnauthorizedError,
  updateIncidentStatus,
} from "../services/api.client";
import type {
  IncidentFilters,
  IncidentItem,
  IncidentStatus,
  OverviewResponse,
  SecurityResponse,
  UptimePoint,
} from "../types/dashboard.types";

export function useDashboardData() {
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");
  const [uptimeHours, setUptimeHours] = useState<number>(24);
  const [filters, setFilters] = useState<IncidentFilters>({
    status: "active",
    category: "all",
    severity: "all",
  });

  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [security, setSecurity] = useState<SecurityResponse | null>(null);
  const [uptimeChecks, setUptimeChecks] = useState<UptimePoint[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [runningChecks, setRunningChecks] = useState(false);

  const [authRequired, setAuthRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadAll]);

  const healthStatus: "healthy" | "warning" | "critical" = useMemo(() => {
    if ((overview?.kpis.criticalIncidents ?? 0) > 0) return "critical";
    if ((overview?.kpis.openIncidents ?? 0) > 0) return "warning";
    return "healthy";
  }, [overview]);

  const runManualScan = useCallback(async () => {
    setRunningChecks(true);
    setToastMessage(null);
    setErrorMessage(null);
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
  }, [loadAll]);

  const changeIncidentStatus = useCallback(
    async (id: string, status: IncidentStatus) => {
      await updateIncidentStatus(id, status);
      await loadAll(true);
    },
    [loadAll]
  );

  const loginWithApiKey = useCallback(
    (apiKey: string) => {
      setSavedApiKey(apiKey);
      void loadAll(false);
    },
    [loadAll]
  );

  const logoutApiKey = useCallback(() => {
    clearSavedApiKey();
    setOverview(null);
    setAuthRequired(true);
    setErrorMessage(null);
  }, []);

  const patchFilters = useCallback((patch: Partial<IncidentFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  return {
    selectedSiteId,
    setSelectedSiteId,
    uptimeHours,
    setUptimeHours,
    filters,
    patchFilters,
    overview,
    incidents,
    security,
    uptimeChecks,
    loading,
    refreshing,
    runningChecks,
    authRequired,
    errorMessage,
    toastMessage,
    setToastMessage,
    healthStatus,
    refresh: () => void loadAll(false),
    runManualScan,
    changeIncidentStatus,
    loginWithApiKey,
    logoutApiKey,
  };
}
