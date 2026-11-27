/**
 * ============================================================================
 * Cliente HTTP Tipado para la API Privada de UMBRAL (`/api/dashboard/*`)
 * ============================================================================
 * Centraliza cabeceras de autenticación, manejo de errores 401/403/429 y
 * almacenamiento efímero de sesión (`sessionStorage`, se borra al cerrar pestaña).
 */

import { STORAGE_KEYS } from "../constants/storage";
import type {
  DemoProbeResult,
  IncidentFilters,
  IncidentItem,
  IncidentNote,
  IncidentStatus,
  OverviewResponse,
  SecurityResponse,
  SiteDeepDiagnostics,
  UptimePoint,
} from "../types/dashboard.types";

export function getSavedApiKey(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.API_KEY_SESSION) ?? "";
  } catch {
    return "";
  }
}

export function setSavedApiKey(key: string): void {
  try {
    const clean = key.trim();
    if (clean) {
      sessionStorage.setItem(STORAGE_KEYS.API_KEY_SESSION, clean);
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.API_KEY_SESSION);
    }
  } catch {
    // Ignorar en modos de navegación sin acceso a storage
  }
}

export function clearSavedApiKey(): void {
  setSavedApiKey("");
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const apiKey = getSavedApiKey();
  if (apiKey) {
    headers.set("X-Dashboard-Key", apiKey);
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  if (res.status === 401 || res.status === 403) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new UnauthorizedError(body.error ?? "No autorizado");
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Error HTTP ${res.status}`);
  }

  return (await res.json()) as T;
}

export function fetchOverview(): Promise<OverviewResponse> {
  return apiFetch<OverviewResponse>("/api/dashboard/overview");
}

export function fetchIncidents(
  filters: IncidentFilters & { siteId?: string }
): Promise<{ incidents: IncidentItem[] }> {
  const params = new URLSearchParams();
  if (filters.siteId && filters.siteId !== "all") params.set("siteId", filters.siteId);
  if (filters.category && filters.category !== "all") params.set("category", filters.category);
  if (filters.severity && filters.severity !== "all") params.set("severity", filters.severity);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  return apiFetch<{ incidents: IncidentItem[] }>(`/api/dashboard/incidents?${params.toString()}`);
}

export function updateIncidentStatus(
  id: string,
  status: IncidentStatus
): Promise<{ ok: boolean; id: string; status: IncidentStatus }> {
  return apiFetch(`/api/dashboard/incidents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function fetchSecurity(siteId?: string): Promise<SecurityResponse> {
  const params = new URLSearchParams();
  if (siteId && siteId !== "all") params.set("siteId", siteId);
  return apiFetch<SecurityResponse>(`/api/dashboard/security?${params.toString()}`);
}

export function fetchUptime(siteId?: string, hours = 24): Promise<{ checks: UptimePoint[] }> {
  const params = new URLSearchParams({ hours: String(hours) });
  if (siteId && siteId !== "all") params.set("siteId", siteId);
  return apiFetch<{ checks: UptimePoint[] }>(`/api/dashboard/uptime?${params.toString()}`);
}

export function triggerManualCheck(): Promise<{
  ok: boolean;
  ranAt: string;
  uptime: Array<{ siteId: string; ok: boolean; statusCode: number | null; latencyMs: number }>;
}> {
  return apiFetch("/api/dashboard/checks/run", { method: "POST" });
}

export function runDemoProbe(url: string): Promise<{ result: DemoProbeResult }> {
  return apiFetch("/api/dashboard/demo/probe", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function simulateDemoIncident(kind: "attack" | "downtime"): Promise<{ ok: boolean }> {
  return apiFetch("/api/dashboard/demo/simulate", {
    method: "POST",
    body: JSON.stringify({ kind }),
  });
}

export function resetDemoData(): Promise<{ ok: boolean }> {
  return apiFetch("/api/dashboard/demo/reset", { method: "POST" });
}

export function bulkUpdateIncidentStatus(
  ids: string[],
  status: IncidentStatus
): Promise<{ ok: boolean; updatedCount: number }> {
  return apiFetch("/api/dashboard/incidents/bulk-status", {
    method: "POST",
    body: JSON.stringify({ ids, status }),
  });
}

export function fetchIncidentNotes(id: string): Promise<{ notes: IncidentNote[] }> {
  return apiFetch(`/api/dashboard/incidents/${encodeURIComponent(id)}/notes`);
}

export function addIncidentNote(
  id: string,
  content: string
): Promise<{ ok: boolean; note: IncidentNote }> {
  return apiFetch(`/api/dashboard/incidents/${encodeURIComponent(id)}/notes`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function setSiteMaintenanceMute(
  siteId: string,
  minutes: number
): Promise<{ ok: boolean; siteId: string; mutedUntil: string | null }> {
  return apiFetch(`/api/dashboard/sites/${encodeURIComponent(siteId)}/mute`, {
    method: "POST",
    body: JSON.stringify({ minutes }),
  });
}

export function inspectSiteDiagnostics(
  siteId: string
): Promise<{ diagnostics: SiteDeepDiagnostics }> {
  return apiFetch(`/api/dashboard/sites/${encodeURIComponent(siteId)}/inspect`, {
    method: "POST",
  });
}

export function sendTestAlert(): Promise<{
  ok: boolean;
  delivery: {
    telegram: "sent" | "skipped" | "failed";
    discord: "sent" | "skipped" | "failed";
  };
}> {
  return apiFetch("/api/dashboard/alerts/test", { method: "POST" });
}
