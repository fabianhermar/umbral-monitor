/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  src/utils/math.ts
 *
 * Copyright (c) 2026 UMBRAL Contributors. All rights reserved.
 *
 * This source code is licensed under the MIT License found in the
 * LICENSE file in the root directory of this source tree.
 *
 * SPDX-License-Identifier: MIT
 */

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
