/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  src/constants/storage.ts
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
 * Constantes de Almacenamiento y Configuración del Cliente Web
 * ============================================================================
 */

export const STORAGE_KEYS = {
  THEME: "umbral_theme",
  API_KEY_SESSION: "umbral_dashboard_api_key",
} as const;

export const AUTO_REFRESH_INTERVAL_MS = 60_000;
