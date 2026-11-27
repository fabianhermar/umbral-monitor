/**
 * ============================================================================
 * Validador y Sanitizador de Entradas de Ingesta (`/api/ingest`)
 * ============================================================================
 * Limpia caracteres de control, limita longitudes, valida enums y neutraliza
 * intentos de Prototype Pollution (`__proto__`, `constructor`, `prototype`)
 * en objetos JSON arbitrarios.
 */

import { VALID_CATEGORIES, VALID_SEVERITIES } from "../constants/security";
import type { IncidentCategory, IncidentSeverity } from "../types";

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export interface ValidatedIngestInput {
  category: IncidentCategory;
  severity: IncidentSeverity;
  title: string;
  description: string;
  fingerprint?: string;
  host?: string;
  path?: string;
  method?: string;
  clientIp?: string;
  country?: string;
  userAgent?: string;
  action?: string;
  metadata: Record<string, unknown>;
}

/** Elimina caracteres de control ASCII invisibles (excepto saltos de línea en descripciones) */
export function cleanText(value: unknown, maxLength: number, allowNewlines = false): string | undefined {
  if (typeof value !== "string") return undefined;
  const regex = allowNewlines ? /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g : /[\x00-\x1F\x7F]/g;
  const cleaned = value.replace(regex, "").trim().slice(0, maxLength);
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Sanitiza recursivamente un objeto de metadatos:
 *  - Descarta claves peligrosas (`__proto__`, `constructor`, `prototype`)
 *  - Limita profundidad máxima (3 niveles) y cantidad de propiedades (25)
 *  - Recorta strings excesivamente largos
 */
export function sanitizeMetadata(
  input: unknown,
  depth = 0
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input) || depth > 3) {
    return {};
  }

  const safeObj: Record<string, unknown> = {};
  const entries = Object.entries(input as Record<string, unknown>).slice(0, 25);

  for (const [rawKey, rawVal] of entries) {
    const key = cleanText(rawKey, 64);
    if (!key || DANGEROUS_KEYS.has(key)) continue;

    if (rawVal === null || typeof rawVal === "boolean") {
      safeObj[key] = rawVal;
    } else if (typeof rawVal === "number" && Number.isFinite(rawVal)) {
      safeObj[key] = rawVal;
    } else if (typeof rawVal === "string") {
      safeObj[key] = cleanText(rawVal, 500, true) ?? "";
    } else if (Array.isArray(rawVal)) {
      safeObj[key] = rawVal.slice(0, 15).map((item) =>
        typeof item === "string"
          ? cleanText(item, 160) ?? ""
          : typeof item === "number" && Number.isFinite(item)
            ? item
            : String(item).slice(0, 80)
      );
    } else if (typeof rawVal === "object") {
      safeObj[key] = sanitizeMetadata(rawVal, depth + 1);
    }
  }

  return safeObj;
}

export function validateIngestPayload(
  raw: unknown
): { ok: true; data: ValidatedIngestInput } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "El cuerpo JSON debe ser un objeto válido." };
  }

  const obj = raw as Record<string, unknown>;
  const category = obj.category as IncidentCategory;
  const severity = obj.severity as IncidentSeverity;

  if (!VALID_CATEGORIES.has(category) || !VALID_SEVERITIES.has(severity)) {
    return { ok: false, error: "Categoría o severidad inválida." };
  }

  const title = cleanText(obj.title, 180);
  const description = cleanText(obj.description, 1000, true);

  if (!title || !description) {
    return { ok: false, error: "Los campos title y description son obligatorios." };
  }

  return {
    ok: true,
    data: {
      category,
      severity,
      title,
      description,
      fingerprint: cleanText(obj.fingerprint, 120),
      host: cleanText(obj.host, 255),
      path: cleanText(obj.path, 300),
      method: cleanText(obj.method, 12)?.toUpperCase(),
      clientIp: cleanText(obj.clientIp, 64),
      country: cleanText(obj.country, 8)?.toUpperCase(),
      userAgent: cleanText(obj.userAgent, 250),
      action: cleanText(obj.action, 40),
      metadata: sanitizeMetadata(obj.metadata),
    },
  };
}
