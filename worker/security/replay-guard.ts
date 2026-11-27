/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  worker/security/replay-guard.ts
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
 * Guardia Anti-Replay de Firmas HMAC
 * ============================================================================
 * Aunque `/api/ingest` ya valida que el timestamp esté dentro de ±5 minutos,
 * este módulo evita que una misma petición firmada sea reenviada múltiples
 * veces dentro de esa ventana de 5 minutos.
 */

const seenSignatures = new Map<string, number>();
const MAX_CACHE_ENTRIES = 2000;

export function consumeSignatureOnce(signatureKey: string, ttlSeconds = 310): boolean {
  const now = Date.now();

  // Limpieza oportunista cuando crece el mapa
  if (seenSignatures.size >= MAX_CACHE_ENTRIES) {
    for (const [key, expiresAt] of seenSignatures.entries()) {
      if (expiresAt <= now) {
        seenSignatures.delete(key);
      }
    }
    // Si sigue lleno tras limpiar expirados, descartar la entrada más antigua
    if (seenSignatures.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = seenSignatures.keys().next().value;
      if (oldestKey) seenSignatures.delete(oldestKey);
    }
  }

  const existingExpiry = seenSignatures.get(signatureKey);
  if (existingExpiry && existingExpiry > now) {
    return false; // Replay detectado
  }

  seenSignatures.set(signatureKey, now + ttlSeconds * 1000);
  return true;
}
