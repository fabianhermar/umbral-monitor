/**
 * ============================================================================
 * Utilidades de Formato Visual y Colores Semánticos
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
