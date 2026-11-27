import { HelpCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getGlossaryEntry } from "../data/glossary";

interface InfoTipProps {
  glossaryKey: string;
  align?: "left" | "right" | "center";
  size?: "sm" | "xs";
}

export function InfoTip({ glossaryKey, align = "center", size = "xs" }: InfoTipProps) {
  const entry = getGlossaryEntry(glossaryKey);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  if (!entry) return null;

  const positionClass =
    align === "left"
      ? "left-0"
      : align === "right"
        ? "right-0"
        : "left-1/2 -translate-x-1/2";

  return (
    <span
      ref={containerRef}
      className="relative inline-flex items-center align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setOpen((v) => !v);
      }}
    >
      <button
        type="button"
        aria-label={`¿Qué significa ${entry.term}?`}
        className={`inline-flex items-center justify-center rounded-full text-[var(--ink-muted)] transition hover:text-[var(--signal-vermilion)] focus:outline-none ${
          size === "sm" ? "h-4 w-4" : "h-3.5 w-3.5"
        }`}
      >
        <HelpCircle className={size === "sm" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      </button>

      {open && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`umbral-panel animate-fade-up absolute bottom-full z-50 mb-2 w-72 rounded-xl p-3.5 text-left shadow-2xl ${positionClass}`}
          style={{
            borderColor: "var(--border-strong)",
            boxShadow: "var(--shadow-elevated)",
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[11px] font-semibold text-[var(--ink-primary)]">
              {entry.term}
            </span>
            {entry.shortTag && (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] uppercase"
                style={{
                  backgroundColor: "var(--bg-inset)",
                  color: entry.accent ?? "var(--ink-secondary)",
                }}
              >
                {entry.shortTag}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11.5px] font-medium leading-snug text-[var(--ink-primary)]">
            {entry.summary}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--ink-secondary)]">
            {entry.details}
          </p>
        </div>
      )}
    </span>
  );
}
