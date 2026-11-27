/**
 * ============================================================================
 * Hook `useKeyboardShortcuts` — Atajos Globales de Productividad
 * ============================================================================
 *  - `ESC`: cierra paneles deslizantes y modales abiertos.
 *  - `?`: abre/cierra el manual de referencia de métricas.
 *  - `R`: refresca los datos del observatorio.
 */

import { useEffect } from "react";

interface ShortcutHandlers {
  onEscape: () => void;
  onToggleGlossary: () => void;
  onRefresh: () => void;
}

export function useKeyboardShortcuts({
  onEscape,
  onToggleGlossary,
  onRefresh,
}: ShortcutHandlers): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onEscape();
        return;
      }

      // No interceptar teclas mientras el usuario escribe en un input/select/textarea
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === "?") {
        onToggleGlossary();
      } else if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey) {
        onRefresh();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onEscape, onToggleGlossary, onRefresh]);
}
