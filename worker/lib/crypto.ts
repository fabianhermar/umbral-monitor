import { ALLOWED_SITE_IDS } from "../../config/sites.config";
import type { Env } from "../types";

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

export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  if (aBytes.length !== bBytes.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

export function getSiteSecret(env: Env, siteId: string): string | null {
  if (!ALLOWED_SITE_IDS.has(siteId) || !env.SITE_SECRETS_JSON) {
    return null;
  }
  try {
    const parsed = JSON.parse(env.SITE_SECRETS_JSON) as Record<string, unknown>;
    const secret = parsed[siteId];
    return typeof secret === "string" && secret.length >= 16 ? secret : null;
  } catch {
    return null;
  }
}
