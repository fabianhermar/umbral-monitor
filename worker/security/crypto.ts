/**
 * @license MIT
 * @project UMBRAL — Private Perimeter & Incident Observatory
 * @module  worker/security/crypto.ts
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
 * Utilidades Criptográficas Seguras (Web Crypto API)
 * ============================================================================
 * Incluye:
 *  - Firma HMAC-SHA256 para autenticar eventos del SDK en Vercel.
 *  - Comparación en tiempo constante real sin fuga de longitud (hasheando
 *    ambas entradas con SHA-256 antes de comparar los 32 bytes resultantes).
 */

import { SECURITY_LIMITS } from "../constants/security";
import type { Env } from "../types";
import { getAllowedSite } from "./allowlist";

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toHex(signature);
}

export async function sha256ShortId(prefix: string, input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return `${prefix}_${toHex(digest).slice(0, 20)}`;
}

/**
 * Compara dos cadenas en tiempo constante SIN filtrar la longitud del secreto.
 * Al aplicar SHA-256 a ambos valores siempre se comparan exactamente 32 bytes.
 */
export async function timingSafeEqualStrings(a: string, b: string): Promise<boolean> {
  const [digestA, digestB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);

  const subtleWithTiming = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (left: ArrayBuffer, right: ArrayBuffer) => boolean;
  };

  if (typeof subtleWithTiming.timingSafeEqual === "function") {
    return subtleWithTiming.timingSafeEqual(digestA, digestB);
  }

  const bytesA = new Uint8Array(digestA);
  const bytesB = new Uint8Array(digestB);
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) {
    diff |= bytesA[i] ^ bytesB[i];
  }
  return diff === 0;
}

export function getSiteSecret(env: Env, siteId: string): string | null {
  if (!getAllowedSite(env, siteId) || !env.SITE_SECRETS_JSON) {
    return null;
  }
  try {
    const parsed = JSON.parse(env.SITE_SECRETS_JSON) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const secret = Object.prototype.hasOwnProperty.call(parsed, siteId)
      ? parsed[siteId]
      : undefined;
    return typeof secret === "string" && secret.length >= SECURITY_LIMITS.MIN_SITE_SECRET_LENGTH
      ? secret
      : null;
  } catch {
    return null;
  }
}
