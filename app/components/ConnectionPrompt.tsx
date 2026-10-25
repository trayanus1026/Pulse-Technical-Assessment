"use client";

import { useEffect, useRef } from "react";
import { VideoIcon } from "./icons";

// Centered prompt for "someone wants to connect" and "start video?".
// Escape declines, the accept button is focused so Enter accepts.
export default function ConnectionPrompt({
  title,
  subtitle,
  color,
  variant = "connect",
  acceptLabel,
  declineLabel,
  onAccept,
  onDecline,
}: {
  title: string;
  subtitle?: string;
  color: string;
  variant?: "connect" | "video";
  acceptLabel: string;
  declineLabel: string;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const acceptRef = useRef<HTMLButtonElement>(null);
  // The parent re-renders on every poll; read the latest handler via a ref so
  // the listener (and initial focus) are set up once, not every 1.5 s.
  const onDeclineRef = useRef(onDecline);
  useEffect(() => {
    onDeclineRef.current = onDecline;
  });

  useEffect(() => {
    acceptRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDeclineRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="prompt-title"
      className="animate-fade absolute inset-0 z-40 flex items-end justify-center bg-ink/55 p-4 backdrop-blur-[2px] sm:items-center"
    >
      <div className="glass animate-sheet w-full max-w-sm rounded-[28px] p-7 text-center sm:animate-rise">
        {/* Incoming orb in the stranger's colour */}
        <div className="relative mx-auto grid h-20 w-20 place-items-center">
          <span
            className="absolute inset-0 m-auto h-10 w-10 animate-sonar rounded-full"
            style={{ background: color, opacity: 0.5 }}
          />
          <span
            className="absolute inset-0 m-auto h-10 w-10 animate-sonar rounded-full"
            style={{ background: color, opacity: 0.5, animationDelay: "1.2s" }}
          />
          <span
            className="relative grid h-12 w-12 place-items-center rounded-full text-ink"
            style={{
              background: `radial-gradient(circle at 35% 30%, #fff, ${color} 60%)`,
              boxShadow: `0 0 30px 4px ${color}`,
            }}
          >
            {variant === "video" && <VideoIcon width={20} height={20} />}
          </span>
        </div>

        <h2
          id="prompt-title"
          className="mt-5 font-display text-[28px] leading-tight text-fg"
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        )}

        <div className="mt-7 flex gap-3">
          <button
            onClick={onDecline}
            className="h-12 flex-1 rounded-full border border-line bg-white/[0.03] text-sm font-medium text-muted transition hover:border-white/20 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/60"
          >
            {declineLabel}
          </button>
          <button
            ref={acceptRef}
            onClick={onAccept}
            className="h-12 flex-1 rounded-full bg-pulse text-sm font-semibold text-ink shadow-[0_10px_30px_-10px_rgb(124_255_196/0.8)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-2 focus-visible:ring-offset-[#10121c]"
          >
            {acceptLabel}
          </button>
        </div>
        <p className="mt-4 text-[11px] text-faint">Esc to decline</p>
      </div>
    </div>
  );
}
