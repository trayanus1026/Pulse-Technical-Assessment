"use client";

import { useEffect, useState } from "react";

// Floating "waiting on the other side" pill with an optional countdown ring.
export default function WaitingPill({
  label,
  color,
  startedAt,
  timeoutMs,
  onCancel,
  position = "top",
}: {
  label: string;
  color: string;
  startedAt?: number;
  timeoutMs?: number;
  onCancel?: () => void;
  position?: "top" | "bottom";
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt || !timeoutMs) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [startedAt, timeoutMs]);

  const remaining =
    startedAt && timeoutMs
      ? Math.max(0, timeoutMs - (now - startedAt))
      : null;
  const progress = remaining !== null && timeoutMs ? remaining / timeoutMs : 1;
  const C = 2 * Math.PI * 15;

  return (
    <div
      role="status"
      className={`glass animate-rise absolute left-1/2 z-30 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full py-2 pl-2 pr-2 text-sm text-fg ${
        position === "top"
          ? "top-[calc(5rem+env(safe-area-inset-top))]"
          : "bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
      }`}
    >
      <span className="relative grid h-9 w-9 shrink-0 place-items-center">
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="2.5" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            className="transition-[stroke-dashoffset] duration-300 ease-linear"
          />
        </svg>
        <span
          className="h-3 w-3 animate-breathe rounded-full"
          style={{ background: color, boxShadow: `0 0 12px ${color}` }}
        />
      </span>
      <span className="truncate">
        {label}
        {remaining !== null && (
          <span className="ml-2 font-mono text-xs tabular-nums text-muted">
            {Math.ceil(remaining / 1000)}s
          </span>
        )}
      </span>
      {onCancel && (
        <button
          onClick={onCancel}
          className="ml-1 h-8 shrink-0 rounded-full bg-white/[0.06] px-3.5 text-xs font-medium text-muted transition hover:bg-white/10 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
