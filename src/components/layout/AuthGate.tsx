/**
 * ============================================================================
 * Componente de Layout — `AuthGate` (Puerta de Acceso Privado)
 * ============================================================================
 * Se muestra cuando el Worker solicita autenticación (`401/403`) y el usuario
 * aún no ha entrado por Cloudflare Access.
 */

import { KeyRound } from "lucide-react";
import { useState } from "react";
import { getSavedApiKey } from "../../services/api.client";
import { UmbralLogo } from "../brand/UmbralLogo";

interface AuthGateProps {
  errorMessage: string | null;
  onSubmitKey: (apiKey: string) => void;
}

export function AuthGate({ errorMessage, onSubmitKey }: AuthGateProps) {
  const [apiKeyInput, setApiKeyInput] = useState(() => getSavedApiKey());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmitKey(apiKeyInput);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-5">
      <form
        onSubmit={handleSubmit}
        className="umbral-panel w-full max-w-md rounded-2xl p-7 shadow-2xl"
      >
        <UmbralLogo size={42} status="warning" showWordmark />

        <div className="mt-6 flex items-center gap-2 font-mono text-[10.5px] tracking-[0.16em] text-[var(--ink-muted)] uppercase">
          <KeyRound className="h-3.5 w-3.5 text-[var(--signal-vermilion)]" />
          ACCESO RESTRINGIDO
        </div>
        <h1 className="mt-1 text-xl font-semibold text-[var(--ink-primary)]">
          Verifica tu identidad
        </h1>

        {errorMessage && (
          <p
            className="mt-3 rounded-xl p-3 text-xs"
            style={{
              backgroundColor: "var(--signal-crimson-soft)",
              color: "var(--signal-crimson)",
            }}
          >
            {errorMessage}
          </p>
        )}

        <label className="mt-4 block font-mono text-[11px] text-[var(--ink-secondary)]">
          DASHBOARD_API_KEY
        </label>
        <input
          type="password"
          autoComplete="current-password"
          value={apiKeyInput}
          onChange={(e) => setApiKeyInput(e.target.value)}
          placeholder="Introduce tu clave privada..."
          className="umbral-inset mt-1.5 w-full rounded-xl px-3.5 py-2.5 font-mono text-sm text-[var(--ink-primary)] outline-none focus:border-[var(--signal-vermilion)]"
        />

        <button
          type="submit"
          className="mt-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          style={{ backgroundColor: "var(--signal-vermilion)" }}
        >
          Entrar a UMBRAL
        </button>

        <p className="mt-3 text-[11px] leading-relaxed text-[var(--ink-muted)]">
          En producción se recomienda Cloudflare Access (Zero Trust) con verificación JWT
          (`CF_ACCESS_TEAM_DOMAIN` + `CF_ACCESS_AUD`) para autenticar directamente con tu correo.
        </p>
      </form>
    </div>
  );
}
