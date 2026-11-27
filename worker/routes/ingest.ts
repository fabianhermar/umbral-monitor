import { Hono } from "hono";
import { getAllowedSite, isAllowedHostForSite } from "../lib/allowlist";
import { getSiteSecret, hmacSha256Hex, sha256ShortId, timingSafeEqual } from "../lib/crypto";
import { upsertIncident } from "../lib/db";
import type { Env, IncidentCategory, IncidentSeverity } from "../types";

const VALID_CATEGORIES = new Set<IncidentCategory>([
  "downtime",
  "attack",
  "block",
  "security",
  "error",
  "deployment",
]);

const VALID_SEVERITIES = new Set<IncidentSeverity>(["low", "medium", "high", "critical"]);

interface IngestPayload {
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
  metadata?: Record<string, unknown>;
}

export const ingestRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /api/ingest
 * Endpoint exclusivo para tus propias apps en Vercel.
 * Valida:
 *  1. x-site-id presente en la lista blanca estática (config/sites.config.ts)
 *  2. x-timestamp dentro de ±5 minutos (anti-replay)
 *  3. x-signature = HMAC-SHA256(siteSecret, `${timestamp}.${rawBody}`)
 *  4. Host/Origin coincidente con los allowedHosts del sitio
 */
ingestRoutes.post("/", async (c) => {
  const siteId = c.req.header("x-site-id")?.trim() ?? "";
  const timestampHeader = c.req.header("x-timestamp")?.trim() ?? "";
  const signatureHeader = c.req.header("x-signature")?.trim().toLowerCase() ?? "";

  const site = getAllowedSite(siteId);
  if (!site) {
    return c.json(
      { error: "Sitio no permitido. Solo se aceptan dominios registrados en la lista blanca." },
      403
    );
  }

  const tsSeconds = Number(timestampHeader);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(tsSeconds) || Math.abs(nowSeconds - tsSeconds) > 300) {
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
  if (!rawBody || rawBody.length > 32_768) {
    return c.json({ error: "Payload vacío o demasiado grande (máx 32 KB)." }, 400);
  }

  const expectedSig = await hmacSha256Hex(secret, `${timestampHeader}.${rawBody}`);
  if (!signatureHeader || !timingSafeEqual(signatureHeader, expectedSig)) {
    return c.json({ error: "Firma HMAC inválida." }, 401);
  }

  let body: IngestPayload;
  try {
    body = JSON.parse(rawBody) as IngestPayload;
  } catch {
    return c.json({ error: "JSON inválido." }, 400);
  }

  // Verificar que el Origin o host declarado pertenezca estrictamente al sitio
  const originHeader = c.req.header("Origin");
  if (originHeader && !isAllowedHostForSite(site, originHeader)) {
    return c.json({ error: "Origin no corresponde a los hosts permitidos del sitio." }, 403);
  }
  if (body.host && !isAllowedHostForSite(site, body.host)) {
    return c.json({ error: "Host del evento fuera de los hosts permitidos del sitio." }, 403);
  }

  if (!VALID_CATEGORIES.has(body.category) || !VALID_SEVERITIES.has(body.severity)) {
    return c.json({ error: "Categoría o severidad inválida." }, 400);
  }
  if (!body.title?.trim() || !body.description?.trim()) {
    return c.json({ error: "title y description son obligatorios." }, 400);
  }

  const fingerprint =
    body.fingerprint?.trim().slice(0, 120) ||
    `app:${site.id}:${body.category}:${body.path ?? "/"}`;

  const result = await upsertIncident(c.env, {
    siteId: site.id,
    fingerprint,
    category: body.category,
    severity: body.severity,
    source: "app-sdk",
    title: body.title.trim().slice(0, 180),
    description: body.description.trim().slice(0, 1000),
    metadata: {
      ...(body.metadata ?? {}),
      host: body.host ?? site.domain,
      path: body.path,
      method: body.method,
      clientIp: body.clientIp,
    },
  });

  // Registrar también en security_events si es ataque, bloqueo o seguridad
  if (
    body.category === "attack" ||
    body.category === "block" ||
    body.category === "security"
  ) {
    const occurredAt = new Date().toISOString();
    const eventId = await sha256ShortId(
      "app",
      `${site.id}|${occurredAt}|${body.clientIp ?? ""}|${body.path ?? ""}|${crypto.randomUUID()}`
    );

    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO security_events
        (id, site_id, occurred_at, source, action, rule_id, rule_source, client_ip, country, host, path, method, user_agent, metadata_json)
       VALUES (?, ?, ?, 'app-sdk', ?, ?, 'app-middleware', ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        eventId,
        site.id,
        occurredAt,
        body.action ?? (body.category === "block" ? "rate_limit" : "alert"),
        fingerprint,
        body.clientIp ?? null,
        body.country ?? null,
        body.host ?? site.domain,
        body.path ?? "/",
        body.method ?? null,
        body.userAgent ?? null,
        JSON.stringify(body.metadata ?? {})
      )
      .run();
  }

  return c.json({ ok: true, incidentId: result.id, created: result.created }, 201);
});
