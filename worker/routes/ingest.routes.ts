/**
 * ============================================================================
 * Ruta de Ingesta Firmada (`POST /api/ingest`)
 * ============================================================================
 * Recibe telemetría en tiempo real desde tus apps en Vercel (`sdk/vercel-monitor.ts`).
 * Capas de seguridad aplicadas en orden:
 *  1. Rate-limiting por IP para frenar inundaciones.
 *  2. Validación de `x-site-id` contra la lista blanca (`config/sites.config.ts`).
 *  3. Ventana anti-replay de ±5 minutos en `x-timestamp`.
 *  4. Verificación HMAC-SHA256 en tiempo constante real sin fuga de longitud.
 *  5. Guardia anti-replay de firmas repetidas dentro de los 5 minutos.
 *  6. Validación de `Origin` y `host` contra `allowedHosts` del sitio.
 *  7. Sanitización profunda del payload y metadatos (anti-Prototype Pollution).
 */

import { Hono } from "hono";
import { SECURITY_LIMITS } from "../constants/security";
import { checkRateLimit } from "../middlewares/rate-limit";
import { insertSecurityEventIgnoreDuplicate } from "../repositories/security-events.repo";
import { getAllowedSite, isAllowedHostForSite } from "../security/allowlist";
import {
  getSiteSecret,
  hmacSha256Hex,
  sha256ShortId,
  timingSafeEqualStrings,
} from "../security/crypto";
import { consumeSignatureOnce } from "../security/replay-guard";
import { upsertIncident } from "../services/incidents.service";
import type { Env } from "../types";
import { validateIngestPayload } from "../validators/ingest.validator";

export const ingestRoutes = new Hono<{ Bindings: Env }>();

ingestRoutes.post("/", async (c) => {
  const clientIpHeader = c.req.header("cf-connecting-ip") ?? "unknown";
  const rl = checkRateLimit(
    `ingest:${clientIpHeader}`,
    SECURITY_LIMITS.INGEST_MAX_REQUESTS_PER_MIN,
    60_000
  );
  if (!rl.allowed) {
    c.header("Retry-After", String(rl.retryAfterSec));
    return c.json({ error: "Límite de peticiones de ingesta excedido." }, 429);
  }

  const siteId = c.req.header("x-site-id")?.trim() ?? "";
  const timestampHeader = c.req.header("x-timestamp")?.trim() ?? "";
  const signatureHeader = c.req.header("x-signature")?.trim().toLowerCase() ?? "";

  const site = getAllowedSite(c.env, siteId);
  if (!site) {
    return c.json(
      { error: "Sitio no permitido. Solo se aceptan dominios registrados en la lista blanca." },
      403
    );
  }

  const tsSeconds = Number(timestampHeader);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    !Number.isFinite(tsSeconds) ||
    Math.abs(nowSeconds - tsSeconds) > SECURITY_LIMITS.INGEST_TIMESTAMP_TOLERANCE_SEC
  ) {
    return c.json({ error: "Timestamp inválido o expirado (> 5 min)." }, 401);
  }

  const secret = getSiteSecret(c.env, site.id);
  if (!secret) {
    return c.json(
      { error: "Secreto HMAC no configurado en SITE_SECRETS_JSON para este sitio." },
      503
    );
  }

  const rawBody = await c.req.text();
  if (!rawBody || rawBody.length > SECURITY_LIMITS.MAX_INGEST_BODY_BYTES) {
    return c.json({ error: "Payload vacío o demasiado grande (máx 32 KB)." }, 400);
  }

  const expectedSig = await hmacSha256Hex(secret, `${timestampHeader}.${rawBody}`);
  const isValidSig =
    signatureHeader.length === 64 && (await timingSafeEqualStrings(signatureHeader, expectedSig));

  if (!isValidSig) {
    return c.json({ error: "Firma HMAC inválida." }, 401);
  }

  if (!consumeSignatureOnce(`${site.id}:${signatureHeader}`)) {
    return c.json({ error: "Petición duplicada detectada (anti-replay)." }, 409);
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "JSON inválido." }, 400);
  }

  const parsed = validateIngestPayload(rawJson);
  if (!parsed.ok) {
    return c.json({ error: parsed.error }, 400);
  }
  const body = parsed.data;

  const originHeader = c.req.header("Origin");
  if (originHeader && !isAllowedHostForSite(site, originHeader)) {
    return c.json({ error: "Origin no corresponde a los hosts permitidos del sitio." }, 403);
  }
  if (body.host && !isAllowedHostForSite(site, body.host)) {
    return c.json({ error: "Host del evento fuera de los hosts permitidos del sitio." }, 403);
  }

  const fingerprint =
    body.fingerprint || `app:${site.id}:${body.category}:${body.path ?? "/"}`;

  const result = await upsertIncident(c.env, {
    siteId: site.id,
    fingerprint,
    category: body.category,
    severity: body.severity,
    source: "app-sdk",
    title: body.title,
    description: body.description,
    metadata: {
      ...body.metadata,
      host: body.host ?? site.domain,
      path: body.path,
      method: body.method,
      clientIp: body.clientIp,
    },
  });

  if (
    body.category === "attack" ||
    body.category === "block" ||
    body.category === "security"
  ) {
    const occurredAt = new Date().toISOString();
    const eventId = await sha256ShortId(
      "app",
      `${site.id}|${signatureHeader}`
    );

    await insertSecurityEventIgnoreDuplicate(c.env.DB, {
      id: eventId,
      siteId: site.id,
      occurredAt,
      source: "app-sdk",
      action: body.action ?? (body.category === "block" ? "rate_limit" : "alert"),
      ruleId: fingerprint,
      ruleSource: "app-middleware",
      clientIp: body.clientIp ?? null,
      country: body.country ?? null,
      host: body.host ?? site.domain,
      path: body.path ?? "/",
      method: body.method ?? null,
      userAgent: body.userAgent ?? null,
      metadataJson: JSON.stringify(body.metadata),
    });
  }

  return c.json({ ok: true, incidentId: result.id, created: result.created }, 201);
});
