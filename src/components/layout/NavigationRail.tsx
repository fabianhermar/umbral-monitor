/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  src/components/layout/NavigationRail.tsx
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
 * Componente de Layout — `NavigationRail`
 * ============================================================================
 * Rail espacial fijo en escritorio (78px) y dock flotante translúcido en móvil.
 * Permite cambiar de sección, alternar tema, abrir la guía, ver integraciones
 * y cerrar sesión cuando se autentica mediante `DASHBOARD_API_KEY`.
 */

import {
  Activity,
  AlertTriangle,
  BookOpen,
  LogOut,
  Moon,
  Radar,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
} from "lucide-react";
import type { NavSection, ThemeMode } from "../../types/dashboard.types";
import { UmbralLogo } from "../brand/UmbralLogo";

interface NavigationRailProps {
  active: NavSection;
  onSelect: (section: NavSection) => void;
  openIncidentsCount: number;
  healthStatus: "healthy" | "warning" | "critical";
  theme: ThemeMode;
  authMode?: "cloudflare-access" | "api-key" | "development" | "demo";
  onToggleTheme: () => void;
  onOpenSetup: () => void;
  onOpenGlossary: () => void;
  onLogout: () => void;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  index: string;
  label: string;
  icon: typeof Radar;
}> = [
  { id: "pulse", index: "01", label: "Pulso", icon: Radar },
  { id: "incidents", index: "02", label: "Incidencias", icon: AlertTriangle },
  { id: "perimeter", index: "03", label: "Perímetro", icon: ShieldAlert },
  { id: "telemetry", index: "04", label: "Telemetría", icon: Activity },
];

export function NavigationRail({
  active,
  onSelect,
  openIncidentsCount,
  healthStatus,
  theme,
  authMode,
  onToggleTheme,
  onOpenSetup,
  onOpenGlossary,
  onLogout,
}: NavigationRailProps) {
  const pulseColor =
    healthStatus === "critical"
      ? "var(--signal-crimson)"
      : healthStatus === "warning"
        ? "var(--signal-ochre)"
        : "var(--signal-mint)";

  return (
    <>
      {/* Rail lateral fijo (Escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[78px] flex-col items-center justify-between border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] py-5 lg:flex">
        <div className="flex flex-col items-center gap-6">
          <button
            type="button"
            onClick={() => onSelect("pulse")}
            title="UMBRAL — Observatorio Privado"
            className="transition-transform duration-200 hover:scale-105"
          >
            <UmbralLogo size={40} status={healthStatus} />
          </button>

          <div className="h-px w-8 bg-[var(--border-subtle)]" />

          <nav className="flex flex-col items-center gap-2" aria-label="Navegación principal">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  title={`${item.index} · ${item.label}`}
                  className={`group relative flex h-12 w-12 flex-col items-center justify-center rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-[var(--ink-primary)] text-[var(--ink-inverse)] shadow-md"
                      : "text-[var(--ink-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--ink-primary)]"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.2 : 1.75} />
                  <span className="mt-0.5 font-mono text-[8.5px] font-medium tracking-wider opacity-75">
                    {item.index}
                  </span>

                  {item.id === "incidents" && openIncidentsCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--signal-vermilion)] px-1 font-mono text-[9px] font-bold text-white">
                      {openIncidentsCount > 99 ? "99+" : openIncidentsCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenGlossary}
            title="Guía completa: ¿qué significa cada dato? (Atajo: ?)"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--ink-secondary)] transition hover:border-[var(--signal-vermilion)] hover:text-[var(--signal-vermilion)]"
          >
            <BookOpen className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            title={
              theme === "obsidian"
                ? "Cambiar a tema claro (Alabastro)"
                : "Cambiar a tema oscuro (Obsidiana)"
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--ink-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)]"
          >
            {theme === "obsidian" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenSetup}
            title="Integraciones, lista blanca y SDK Vercel"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--ink-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)]"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>

          {authMode === "api-key" && (
            <button
              type="button"
              onClick={onLogout}
              title="Cerrar sesión (borrar API Key de esta pestaña)"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] text-[var(--ink-secondary)] transition hover:border-[var(--signal-crimson)] hover:text-[var(--signal-crimson)]"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}

          <div
            className="mt-1 flex flex-col items-center gap-1"
            title="Monitorización automática activa"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span
                className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full"
                style={{ backgroundColor: pulseColor }}
              />
              <span
                className="relative inline-flex h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: pulseColor }}
              />
            </span>
            <span className="font-mono text-[8px] tracking-widest text-[var(--ink-muted)] uppercase">
              LIVE
            </span>
          </div>
        </div>
      </aside>

      {/* Dock flotante (Móvil / Tablet) */}
      <nav
        className="umbral-glass fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl border p-1.5 shadow-2xl lg:hidden"
        aria-label="Navegación móvil"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                isActive
                  ? "bg-[var(--ink-primary)] text-[var(--ink-inverse)]"
                  : "text-[var(--ink-secondary)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{item.label}</span>
              {item.id === "incidents" && openIncidentsCount > 0 && (
                <span className="rounded-full bg-[var(--signal-vermilion)] px-1.5 py-0.2 font-mono text-[10px] font-bold text-white">
                  {openIncidentsCount}
                </span>
              )}
            </button>
          );
        })}

        <div className="mx-1 h-5 w-px bg-[var(--border-subtle)]" />

        <button
          type="button"
          onClick={onOpenGlossary}
          className="rounded-xl p-2 text-[var(--ink-secondary)]"
          title="Guía de métricas"
        >
          <BookOpen className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="rounded-xl p-2 text-[var(--ink-secondary)]"
          title="Cambiar tema"
        >
          {theme === "obsidian" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={onOpenSetup}
          className="rounded-xl p-2 text-[var(--ink-secondary)]"
          title="Integraciones y SDK"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>

        {authMode === "api-key" && (
          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl p-2 text-[var(--ink-secondary)]"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </nav>
    </>
  );
}
