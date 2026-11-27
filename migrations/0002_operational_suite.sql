-- ============================================================================
-- Migración 0002 — Suite Operativa SRE (Notas Post-Mortem y Modo Mantenimiento)
-- ============================================================================

-- 1. Ventana de mantenimiento / silencio de alertas por sitio
ALTER TABLE site_runtime_state ADD COLUMN muted_until TEXT;

-- 2. Bitácora de notas de investigación por incidencia
CREATE TABLE IF NOT EXISTS incident_notes (
  id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incident_notes_incident
  ON incident_notes (incident_id, created_at ASC);
