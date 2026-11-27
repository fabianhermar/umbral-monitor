/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  src/components/ui/InfoTip.tsx
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
 * Primitiva UI — `InfoTip` (Tooltip Contextual en Portal Global)
 * ============================================================================
 * Renderiza el pop-up directamente en `document.body` mediante `createPortal`
 * con `position: fixed` y `z-[9999]`. Esto garantiza que jamás quede debajo de
 * otras tarjetas con `transform`/`overflow-hidden` ni se recorte en los bordes
 * de la pantalla.
 */

import { HelpCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getGlossaryEntry } from "../../constants/glossary";

interface InfoTipProps {
  glossaryKey: string;
  align?: "left" | "right" | "center";
  size?: "sm" | "xs";
}

interface PopoverCoords {
  top: number;
  left: number;
  placement: "top" | "bottom";
}

const POPOVER_WIDTH = 288; // 18rem (w-72)
const VIEWPORT_MARGIN = 12;

export function InfoTip({ glossaryKey, align = "center", size = "xs" }: InfoTipProps) {
  const entry = getGlossaryEntry(glossaryKey);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const vw = window.innerWidth;
    const width = Math.min(POPOVER_WIDTH, vw - VIEWPORT_MARGIN * 2);

    let left = rect.left + rect.width / 2 - width / 2;
    if (align === "left") {
      left = rect.left;
    } else if (align === "right") {
      left = rect.right - width;
    }

    // Evitar que se salga por izquierda o derecha del viewport
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, vw - width - VIEWPORT_MARGIN));

    // Si hay poco espacio arriba, abrir hacia abajo
    const estimatedHeight = 155;
    const openAbove = rect.top >= estimatedHeight + 16;
    const top = openAbove ? rect.top - 10 : rect.bottom + 10;

    setCoords({
      top,
      left,
      placement: openAbove ? "top" : "bottom",
    });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    updatePosition();

    function handleOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleScrollOrResize() {
      updatePosition();
    }

    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open, updatePosition]);

  if (!entry) return null;

  return (
    <span
      className="relative inline-flex items-center align-middle"
      onMouseEnter={() => {
        updatePosition();
        setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        updatePosition();
        setOpen((v) => !v);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`¿Qué significa ${entry.term}?`}
        className={`inline-flex items-center justify-center rounded-full text-[var(--ink-muted)] transition hover:text-[var(--signal-vermilion)] focus:outline-none ${
          size === "sm" ? "h-4 w-4" : "h-3.5 w-3.5"
        }`}
      >
        <HelpCircle className={size === "sm" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      </button>

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            role="tooltip"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onClick={(e) => e.stopPropagation()}
            className="umbral-panel fixed z-[9999] w-72 max-w-[calc(100vw-24px)] rounded-xl p-3.5 text-left shadow-2xl"
            style={{
              top: coords.top,
              left: coords.left,
              transform: coords.placement === "top" ? "translateY(-100%)" : "none",
              borderColor: "var(--border-strong)",
              boxShadow: "var(--shadow-elevated)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] font-semibold text-[var(--ink-primary)]">
                {entry.term}
              </span>
              {entry.shortTag && (
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase"
                  style={{
                    backgroundColor: "var(--bg-inset)",
                    color: entry.accent ?? "var(--ink-secondary)",
                  }}
                >
                  {entry.shortTag}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[11.5px] font-medium leading-snug text-[var(--ink-primary)]">
              {entry.summary}
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--ink-secondary)]">
              {entry.details}
            </p>
          </div>,
          document.body
        )}
    </span>
  );
}
