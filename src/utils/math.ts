/**
 * ============================================================================
 * Utilidades Matemáticas y Geométricas (Percentiles y Arcos SVG)
 * ============================================================================
 */

/** Calcula un percentil (ej. P50 o P95) sobre un arreglo numérico ya ordenado ascendentemente */
export function computePercentile(sortedAscending: number[], p: number): number | null {
  if (sortedAscending.length === 0) return null;
  const idx = Math.min(
    sortedAscending.length - 1,
    Math.floor((p / 100) * sortedAscending.length)
  );
  return sortedAscending[idx];
}

/** Calcula `circumference` y `offset` para dibujar un arco circular SVG porcentual */
export function computeSvgArcDash(percent: number, radius: number): {
  circumference: number;
  offset: number;
} {
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  return {
    circumference,
    offset: circumference * (1 - clamped / 100),
  };
}
