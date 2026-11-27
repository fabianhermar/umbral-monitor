/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  src/utils/export.ts
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
 * Utilidades de Exportación de Reportes (`CSV` y `JSON`)
 * ============================================================================
 * Permite descargar en 1 clic el historial filtrado de incidencias o la
 * bitácora de IPs/eventos de seguridad para auditorías o reglas de firewall.
 */

import type { IncidentItem, SecurityEventItem } from "../types/dashboard.types";

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  // Prevenir inyección de fórmulas CSV en Excel/Sheets (=, +, -, @)
  const neutralized = /^[=+\-@]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

function triggerBrowserDownload(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportIncidentsToCsv(incidents: IncidentItem[]): void {
  const headers = [
    "id",
    "site_id",
    "category",
    "severity",
    "status",
    "source",
    "occurrences",
    "started_at",
    "last_seen_at",
    "resolved_at",
    "title",
    "description",
  ];
  const rows = incidents.map((inc) =>
    [
      inc.id,
      inc.site_id,
      inc.category,
      inc.severity,
      inc.status,
      inc.source,
      inc.occurrences,
      inc.started_at,
      inc.last_seen_at,
      inc.resolved_at ?? "",
      inc.title,
      inc.description,
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  const stamp = new Date().toISOString().slice(0, 10);
  triggerBrowserDownload(
    `umbral-incidencias-${stamp}.csv`,
    "text/csv;charset=utf-8",
    `\uFEFF${[headers.join(","), ...rows].join("\n")}`
  );
}

export function exportIncidentsToJson(incidents: IncidentItem[]): void {
  const stamp = new Date().toISOString().slice(0, 10);
  triggerBrowserDownload(
    `umbral-incidencias-${stamp}.json`,
    "application/json;charset=utf-8",
    JSON.stringify(incidents, null, 2)
  );
}

export function exportSecurityEventsToCsv(events: SecurityEventItem[]): void {
  const headers = [
    "id",
    "occurred_at",
    "site_id",
    "host",
    "action",
    "client_ip",
    "country",
    "method",
    "path",
    "source",
    "rule_source",
    "rule_id",
  ];
  const rows = events.map((ev) =>
    [
      ev.id,
      ev.occurred_at,
      ev.site_id,
      ev.host ?? "",
      ev.action,
      ev.client_ip ?? "",
      ev.country ?? "",
      ev.method ?? "",
      ev.path ?? "",
      ev.source,
      ev.rule_source ?? "",
      ev.rule_id ?? "",
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  const stamp = new Date().toISOString().slice(0, 10);
  triggerBrowserDownload(
    `umbral-perimetro-${stamp}.csv`,
    "text/csv;charset=utf-8",
    `\uFEFF${[headers.join(","), ...rows].join("\n")}`
  );
}

export function exportSecurityEventsToJson(events: SecurityEventItem[]): void {
  const stamp = new Date().toISOString().slice(0, 10);
  triggerBrowserDownload(
    `umbral-perimetro-${stamp}.json`,
    "application/json;charset=utf-8",
    JSON.stringify(events, null, 2)
  );
}
