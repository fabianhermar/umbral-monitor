/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  src/hooks/useTheme.ts
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
 * Hook `useTheme` — Tema Dual Persistente (Obsidiana / Alabastro)
 * ============================================================================
 */

import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "../constants/storage";
import type { ThemeMode } from "../types/dashboard.types";

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.THEME) === "alabaster"
        ? "alabaster"
        : "obsidian";
    } catch {
      return "obsidian";
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch {
      // Ignorar si localStorage está restringido
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "obsidian" ? "alabaster" : "obsidian"));
  };

  return { theme, toggleTheme };
}
