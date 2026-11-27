/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  tests/frontend/math-and-export.test.ts
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
 * Suite Frontend 06 — Matemáticas, Duraciones y Protección Anti-Inyección CSV
 * ============================================================================
 */

import { describe, expect, it } from "vitest";
import { formatIncidentDuration } from "../../src/utils/formatters";
import { computePercentile, computeSvgArcDash } from "../../src/utils/math";

describe("Cálculo de Percentiles y Geometría de Arcos SVG", () => {
  it("calcula P50 y P95 con precisión y maneja arreglos vacíos", () => {
    expect(computePercentile([], 50)).toBeNull();
    const sorted = [100, 120, 130, 140, 150, 160, 180, 200, 250, 900];
    expect(computePercentile(sorted, 50)).toBe(160);
    expect(computePercentile(sorted, 95)).toBe(900);
  });

  it("limita porcentajes entre 0 y 100 al calcular arcos SVG", () => {
    const full = computeSvgArcDash(100, 50);
    expect(full.offset).toBeCloseTo(0, 5);

    const zero = computeSvgArcDash(-20, 50);
    expect(zero.offset).toBeCloseTo(full.circumference, 5);
  });

  it("formatea duraciones de incidencias de forma legible", () => {
    const start = "2026-11-27T00:00:00.000Z";
    expect(formatIncidentDuration(start, "2026-11-27T00:00:45.000Z")).toBe("45s");
    expect(formatIncidentDuration(start, "2026-11-27T00:15:00.000Z")).toBe("15m");
    expect(formatIncidentDuration(start, "2026-11-27T02:30:00.000Z")).toBe("2h 30m");
  });
});
