/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  worker/repositories/notes.repo.ts
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
 * Repositorio SQL D1 — Tabla `incident_notes`
 * ============================================================================
 * Gestiona las notas de investigación / post-mortem asociadas a cada incidencia.
 */

import type { IncidentNoteRow } from "../types";

export async function listIncidentNotes(
  db: D1Database,
  incidentId: string
): Promise<IncidentNoteRow[]> {
  const res = await db
    .prepare(
      `SELECT id, incident_id, author, content, created_at
       FROM incident_notes
       WHERE incident_id = ?
       ORDER BY created_at ASC
       LIMIT 100`
    )
    .bind(incidentId)
    .all<IncidentNoteRow>();
  return res.results;
}

export async function insertIncidentNote(
  db: D1Database,
  params: {
    id: string;
    incidentId: string;
    author: string;
    content: string;
    createdAt: string;
  }
): Promise<IncidentNoteRow> {
  await db
    .prepare(
      `INSERT INTO incident_notes (id, incident_id, author, content, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(params.id, params.incidentId, params.author, params.content, params.createdAt)
    .run();

  return {
    id: params.id,
    incident_id: params.incidentId,
    author: params.author,
    content: params.content,
    created_at: params.createdAt,
  };
}
