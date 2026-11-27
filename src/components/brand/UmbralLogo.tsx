/**
 * ============================================================================
 * Componente de Marca — `UmbralLogo`
 * ============================================================================
 * Monolito arquitectónico en U con biseles de 45°, horizonte del umbral y
 * eclipse centinela reactivo al estado de salud del perímetro.
 */

interface UmbralLogoProps {
  size?: number;
  status?: "healthy" | "warning" | "critical";
  showWordmark?: boolean;
}

export function UmbralLogo({
  size = 38,
  status = "healthy",
  showWordmark = false,
}: UmbralLogoProps) {
  const signalColor =
    status === "critical"
      ? "var(--signal-crimson)"
      : status === "warning"
        ? "var(--signal-ochre)"
        : "var(--signal-vermilion)";

  return (
    <div className="inline-flex items-center gap-3 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
        aria-label="UMBRAL"
      >
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="15"
          fill="var(--bg-inset)"
          stroke="var(--border-strong)"
          strokeWidth="1.5"
        />

        {/* Resplandor sutil del centinela */}
        <circle cx="32" cy="29" r="16" fill={signalColor} fillOpacity="0.14" />

        {/* Monolito sólido en U con biseles arquitectónicos de 45° */}
        <path
          d="M13 18.5L17.5 14H22V34C22 39.5228 26.4772 44 32 44C37.5228 44 42 39.5228 42 34V14H46.5L51 18.5V34C51 44.4934 42.4934 53 32 53C21.5066 53 13 44.4934 13 34V18.5Z"
          fill="var(--ink-primary)"
        />

        {/* Eclipse centinela naciente */}
        <path
          d="M25.5 28.5C25.5 24.9101 28.4101 22 32 22C35.5899 22 38.5 24.9101 38.5 28.5H25.5Z"
          fill={signalColor}
        />

        {/* Barra principal del umbral */}
        <rect x="24.5" y="31" width="15" height="3" rx="1.5" fill={signalColor} />

        {/* Reflejo inferior */}
        <rect x="27.5" y="36.2" width="9" height="2" rx="1" fill={signalColor} fillOpacity="0.45" />
      </svg>

      {showWordmark && (
        <div className="leading-none">
          <div className="text-base font-bold tracking-[0.2em] text-[var(--ink-primary)]">
            UMBRAL
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className="inline-block h-[2px] w-4 rounded-full"
              style={{ backgroundColor: signalColor }}
            />
            <span className="font-mono text-[9.5px] tracking-[0.2em] text-[var(--ink-muted)] uppercase">
              Private Perimeter OS
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
