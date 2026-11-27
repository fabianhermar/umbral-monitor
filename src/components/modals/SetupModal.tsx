/**
 * ============================================================================
 * Modal de Configuración — `SetupModal`
 * ============================================================================
 * Muestra el estado de cada integración configurada en el Worker (sin exponer
 * los valores secretos) y ofrece un ejemplo copiable del SDK de Vercel.
 */

import { BellRing, CheckCircle2, Copy, X, XCircle } from "lucide-react";
import { useState } from "react";
import { sendTestAlert } from "../../services/api.client";
import type { OverviewResponse } from "../../types/dashboard.types";
import { UmbralLogo } from "../brand/UmbralLogo";

interface SetupModalProps {
  open: boolean;
  overview: OverviewResponse | null;
  onClose: () => void;
}

const SDK_SNIPPET = `import { reportSecurityBlock, reportAppError } from "@/lib/vercel-monitor";

// En tu API Route o Middleware de Vercel:
await reportSecurityBlock(
  req,
  "Más de 10 intentos fallidos de acceso en 1 minuto.",
  "high"
);`;

export function SetupModal({ open, overview, onClose }: SetupModalProps) {
  const [copied, setCopied] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [alertResult, setAlertResult] = useState<string | null>(null);

  if (!open) return null;

  async function handleTestAlert() {
    setTestingAlert(true);
    setAlertResult(null);
    try {
      const res = await sendTestAlert();
      setAlertResult(
        `Resultado — Telegram: ${res.delivery.telegram.toUpperCase()} · Discord: ${res.delivery.discord.toUpperCase()}`
      );
    } catch (err) {
      setAlertResult(err instanceof Error ? err.message : "Error enviando prueba");
    } finally {
      setTestingAlert(false);
    }
  }

  const integrations = overview?.integrations;

  const rows = [
    {
      label: "Cloudflare GraphQL API (WAF / DDoS / Bloqueos)",
      ok: Boolean(integrations?.cloudflareConfigured),
      hint: "Secreto CLOUDFLARE_API_TOKEN + cloudflareZoneId por dominio en config/sites.config.ts",
    },
    {
      label: "Vercel REST API (Despliegues fallidos)",
      ok: Boolean(integrations?.vercelConfigured),
      hint: "Secreto VERCEL_API_TOKEN + vercelProjectId por dominio en config/sites.config.ts",
    },
    {
      label: "Ingesta HMAC-SHA256 + Anti-Replay",
      ok: Boolean(integrations?.ingestSecretsConfigured),
      hint: "SITE_SECRETS_JSON configurado + sdk/vercel-monitor.ts instalado en tus proyectos",
    },
    {
      label: "Cloudflare Access Zero Trust (JWT RS256)",
      ok: Boolean(integrations?.cfAccessVerifiedConfigured),
      hint: "Opcional: CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD para verificar firma JWT de Zero Trust",
    },
    {
      label: "Alertas Instantáneas (Telegram / Discord)",
      ok: Boolean(integrations?.telegramConfigured || integrations?.discordConfigured),
      hint: "TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID o DISCORD_WEBHOOK_URL",
    },
  ];

  async function copySnippet() {
    await navigator.clipboard.writeText(SDK_SNIPPET).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/65 backdrop-blur-xs" onClick={onClose} />

      <div className="umbral-panel animate-fade-up relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <UmbralLogo size={36} showWordmark />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-2 text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
          UMBRAL opera bajo lista blanca estricta definida en{" "}
          <code className="rounded bg-[var(--bg-inset)] px-1.5 py-0.5 text-[var(--signal-vermilion)]">
            config/sites.config.ts
          </code>
          . Cualquier dominio externo, host suplantado, repetición o firma HMAC inválida es
          rechazado automáticamente.
        </p>

        <div className="mt-4 space-y-2.5">
          {rows.map((item) => (
            <div key={item.label} className="umbral-inset flex items-start gap-3 rounded-xl p-3.5">
              {item.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--signal-mint)]" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
              )}
              <div>
                <div className="text-xs font-semibold text-[var(--ink-primary)]">{item.label}</div>
                <div className="mt-0.5 text-[11px] text-[var(--ink-muted)]">{item.hint}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-inset)] p-3.5">
          <div className="text-xs text-[var(--ink-secondary)]">
            Verifica que Telegram y/o Discord reciben mensajes sin esperar a una caída real:
            {alertResult && (
              <div className="mt-1 font-mono text-[11px] font-semibold text-[var(--signal-mint)]">
                {alertResult}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={testingAlert}
            onClick={() => void handleTestAlert()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-1.5 font-mono text-xs font-semibold text-[var(--ink-primary)] transition hover:border-[var(--signal-vermilion)] hover:text-[var(--signal-vermilion)] disabled:opacity-50"
          >
            <BellRing className="h-3.5 w-3.5" />
            {testingAlert ? "Enviando..." : "Enviar alerta de prueba"}
          </button>
        </div>

        <div className="umbral-inset mt-5 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.16em] text-[var(--ink-muted)] uppercase">
              SDK PARA TUS PROYECTOS EN VERCEL
            </span>
            <button
              type="button"
              onClick={() => void copySnippet()}
              className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 font-mono text-[10.5px] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
            >
              <Copy className="h-3 w-3" />
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <pre className="mt-3 overflow-x-auto font-mono text-[11.5px] leading-relaxed text-[var(--ink-primary)]">
            {SDK_SNIPPET}
          </pre>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="font-mono text-[10.5px] text-[var(--ink-muted)]">
            Atajos: <kbd className="rounded border border-[var(--border-strong)] px-1">R</kbd>{" "}
            refrescar · <kbd className="rounded border border-[var(--border-strong)] px-1">?</kbd>{" "}
            guía · <kbd className="rounded border border-[var(--border-strong)] px-1">ESC</kbd>{" "}
            cerrar
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[var(--ink-primary)] px-4 py-2 text-xs font-semibold text-[var(--ink-inverse)]"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
