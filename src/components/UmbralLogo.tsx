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
  const coreColor =
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
          x="3.5"
          y="3.5"
          width="57"
          height="57"
          rx="15"
          fill="var(--bg-inset)"
          stroke="var(--border-strong)"
          strokeWidth="1.5"
        />
        {/* Monolithic threshold portal */}
        <path
          d="M18 18V33C18 40.732 24.268 47 32 47C39.732 47 46 40.732 46 33V18"
          stroke="var(--ink-primary)"
          strokeWidth="3.2"
          strokeLinecap="square"
        />
        {/* Precision horizon ticks */}
        <path
          d="M11.5 32H15M49 32H52.5M32 11V14.5"
          stroke="var(--ink-muted)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        {/* Inner protective arch */}
        <path
          d="M24 23V32.5C24 36.9183 27.5817 40.5 32 40.5C36.4183 40.5 40 36.9183 40 32.5V23"
          stroke={coreColor}
          strokeOpacity="0.55"
          strokeWidth="1.75"
        />
        {/* Live signal core */}
        <circle cx="32" cy="30" r="8.5" stroke={coreColor} strokeOpacity="0.3" strokeWidth="1" />
        <circle cx="32" cy="30" r="4.4" fill={coreColor} />
      </svg>

      {showWordmark && (
        <div className="leading-none">
          <div className="text-base font-bold tracking-[0.2em] text-[var(--ink-primary)]">
            UMBRAL
          </div>
          <div className="mt-1 font-mono text-[9.5px] tracking-[0.22em] text-[var(--ink-muted)] uppercase">
            Private Perimeter OS
          </div>
        </div>
      )}
    </div>
  );
}
