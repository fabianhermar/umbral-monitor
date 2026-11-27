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
