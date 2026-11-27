/**
 * ============================================================================
 * Utilidades de Formato Visual, Duraciones y Colores Semánticos
 * ============================================================================
 */

import type { SiteOperationalStatus } from "../types/dashboard.types";

/** Convierte un timestamp ISO en texto relativo breve ("hace 12s", "hace 4m") */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "sin chequeo";
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `hace ${sec}s`;
  if (sec < 3600) return `hace ${Math.floor(sec / 60)}m`;
  return `hace ${Math.floor(sec / 3600)}h`;
}

/** Calcula la duración legible entre el inicio de una incidencia y su cierre (o ahora) */
export function formatIncidentDuration(startedAt: string, resolvedAt: string | null): string {
  const startMs = new Date(startedAt).getTime();
  const endMs = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const totalSec = Math.max(1, Math.floor((endMs - startMs) / 1000));

  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function getSiteStatusDotColor(status: SiteOperationalStatus): string {
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
