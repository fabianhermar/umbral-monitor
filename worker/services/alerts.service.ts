/**
 * ============================================================================
 * Servicio de Notificaciones Salientes (Telegram & Discord)
 * ============================================================================
 * Envía alertas en tiempo real únicamente para eventos de severidad Alta/Crítica
 * o recuperaciones de caídas y despliegues, evitando fatiga de alertas.
 */

import type { Env, IncidentCategory, IncidentSeverity } from "../types";

export interface AlertPayload {
  event: "opened" | "escalated" | "resolved";
  siteName: string;
  siteDomain: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  title: string;
  description: string;
  occurrences?: number;
}

const SEVERITY_EMOJI: Record<IncidentSeverity, string> = {
  low: "ℹ️",
  medium: "⚠️",
  high: "🚨",
  critical: "🔥",
};

const CATEGORY_LABEL: Record<IncidentCategory, string> = {
  downtime: "Caída / Disponibilidad",
  attack: "Ataque",
  block: "Bloqueo",
  security: "Seguridad",
  error: "Error de aplicación",
  deployment: "Despliegue Vercel",
};

export async function sendIncidentAlert(env: Env, payload: AlertPayload): Promise<void> {
  const shouldNotify =
    payload.severity === "high" ||
    payload.severity === "critical" ||
    (payload.event === "resolved" &&
      (payload.category === "downtime" || payload.category === "deployment"));

  if (!shouldNotify) return;

  const prefix =
    payload.event === "resolved"
      ? "✅ RECUPERADO"
      : payload.event === "escalated"
        ? "⬆️ ESCALADO"
        : `${SEVERITY_EMOJI[payload.severity]} UMBRAL ALERTA`;

  const lines = [
    `${prefix} [${payload.siteName} · ${payload.siteDomain}]`,
    `Tipo: ${CATEGORY_LABEL[payload.category]} | Severidad: ${payload.severity.toUpperCase()}`,
    `Título: ${payload.title}`,
    payload.description,
    payload.occurrences && payload.occurrences > 1
      ? `Ocurrencias agrupadas: ${payload.occurrences}`
      : null,
  ].filter(Boolean);

  const text = lines.join("\n");
  const tasks: Promise<unknown>[] = [];

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    tasks.push(
      fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text,
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => undefined)
    );
  }

  if (env.DISCORD_WEBHOOK_URL) {
    const color =
      payload.event === "resolved"
        ? 0x22e39b
        : payload.severity === "critical"
          ? 0xff3b5c
          : 0xff5428;

    tasks.push(
      fetch(env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: `${prefix}: ${payload.title}`,
              description: payload.description,
              color,
              fields: [
                { name: "Sitio", value: `${payload.siteName} (${payload.siteDomain})`, inline: true },
                { name: "Categoría", value: CATEGORY_LABEL[payload.category], inline: true },
                { name: "Severidad", value: payload.severity.toUpperCase(), inline: true },
              ],
              timestamp: new Date().toISOString(),
            },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => undefined)
    );
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
}

/**
 * Envía un mensaje de prueba inmediato a Telegram y/o Discord para verificar
 * que las credenciales están bien configuradas sin esperar a una caída real.
 */
export async function sendTestAlertNotification(env: Env): Promise<{
  telegram: "sent" | "skipped" | "failed";
  discord: "sent" | "skipped" | "failed";
}> {
  const result: {
    telegram: "sent" | "skipped" | "failed";
    discord: "sent" | "skipped" | "failed";
  } = {
    telegram: "skipped",
    discord: "skipped",
  };

  const nowStr = new Date().toISOString();

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: `✅ UMBRAL — Prueba de alerta exitosa\nTu canal de Telegram está conectado correctamente (${nowStr}).`,
          }),
          signal: AbortSignal.timeout(5000),
        }
      );
      result.telegram = res.ok ? "sent" : "failed";
    } catch {
      result.telegram = "failed";
    }
  }

  if (env.DISCORD_WEBHOOK_URL) {
    try {
      const res = await fetch(env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              title: "✅ UMBRAL — Prueba de alerta exitosa",
              description:
                "Tu Webhook de Discord está conectado correctamente y listo para recibir alertas críticas.",
              color: 0x22e39b,
              timestamp: nowStr,
            },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });
      result.discord = res.ok ? "sent" : "failed";
    } catch {
      result.discord = "failed";
    }
  }

  return result;
}
