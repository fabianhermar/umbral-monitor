import type {
  IncidentItem,
  IncidentStatus,
  OverviewResponse,
  SecurityResponse,
  UptimePoint,
} from "./types";

const API_KEY_STORAGE = "soon_dashboard_api_key";

export function getSavedApiKey(): string {
  return sessionStorage.getItem(API_KEY_STORAGE) ?? "";
}

export function setSavedApiKey(key: string): void {
  if (key.trim()) {
    sessionStorage.setItem(API_KEY_STORAGE, key.trim());
  } else {
    sessionStorage.removeItem(API_KEY_STORAGE);
  }
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

  const res = await fetch(path, { ...init, headers });
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

export function fetchIncidents(filters: {
  siteId?: string;
  category?: string;
  severity?: string;
  status?: string;
}): Promise<{ incidents: IncidentItem[] }> {
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
