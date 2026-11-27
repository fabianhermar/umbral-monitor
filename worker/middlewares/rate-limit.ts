/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  worker/middlewares/rate-limit.ts
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
 * Limitador de Tasa (Rate Limiter) Ligero en Memoria del Isolate
 * ============================================================================
 * Protege contra fuerza bruta sobre `DASHBOARD_API_KEY`, abuso sobre
 * `/api/ingest` y ejecuciones repetitivas de `POST /api/dashboard/checks/run`.
 */

interface WindowBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, WindowBucket>();
let lastManualScanAt = 0;

export function checkRateLimit(
  bucketKey: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();

  if (buckets.size > 2000) {
    for (const [k, v] of buckets.entries()) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }

  const existing = buckets.get(bucketKey);
  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function checkManualScanCooldown(cooldownMs: number): {
  allowed: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const elapsed = now - lastManualScanAt;
  if (lastManualScanAt > 0 && elapsed < cooldownMs) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000)),
    };
  }
  lastManualScanAt = now;
  return { allowed: true, retryAfterSec: 0 };
}
