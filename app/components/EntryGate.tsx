"use client";

import { useState } from "react";
import { GhostIcon, PinIcon, ShieldIcon } from "./icons";

// Deterministic "strangers" scattered over the horizon (no Math.random, so the
// server and client render the same markup).
const STARS = Array.from({ length: 34 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12543.1234;
  const fx = a - Math.floor(a);
  const fy = b - Math.floor(b);
  // Keep the central column clear so stars never sit on top of the copy.
  const inTextColumn = fx > 0.2 && fx < 0.8;
  return {
    left: `${4 + fx * 92}%`,
    top: inTextColumn ? `${4 + fy * 12}%` : `${8 + fy * 58}%`,
    hue: Math.round(fx * 360),
    delay: `${(fy * 3.2).toFixed(2)}s`,
    size: 3 + Math.round(fx * 3),
  };
});

export default function EntryGate({
  onReady,
}: {
  onReady: (lat: number, lng: number) => void;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string>("");

  function enter() {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Your browser doesn't support location access.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => onReady(pos.coords.latitude, pos.coords.longitude),
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Pulse needs your location to place you on the globe. Allow it in your browser and try again."
            : "Couldn't find you just now. Please try again.",
        );
      },
      // High accuracy + maximumAge:0 forces a fresh fix (Wi-Fi/GPS scan)
      // instead of reusing the browser's cached IP-based location.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  const locating = status === "locating";

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-ink">
      {/* Backdrop: twinkling strangers + a glowing planet horizon */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgb(56_80_160/0.25),transparent_55%)]" />
        {STARS.map((s, i) => (
          <span
            key={i}
            className="absolute animate-breathe rounded-full"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              animationDelay: s.delay,
              background: `hsl(${s.hue} 85% 70%)`,
              boxShadow: `0 0 10px 1px hsl(${s.hue} 85% 65% / 0.8)`,
            }}
          />
        ))}
        {/* Planet */}
        <div className="absolute left-1/2 top-[68%] aspect-square w-[170vmax] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_0%,#101a2e,#05060a_45%)] shadow-[0_-2px_0_0_rgb(124_255_196/0.55),0_-30px_120px_10px_rgb(31_214_154/0.28),0_-80px_220px_40px_rgb(60_90_220/0.18)]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-[18vh] pt-16 text-center">
        <p className="animate-rise inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-sonar rounded-full bg-pulse" />
            <span className="relative h-2 w-2 rounded-full bg-pulse" />
          </span>
          Live, right now
        </p>

        <h1
          className="animate-rise mt-7 max-w-3xl font-display text-[clamp(3rem,9vw,6.5rem)] leading-[0.95] tracking-[-0.02em] text-fg"
          style={{ animationDelay: "80ms" }}
        >
          Somewhere out there,{" "}
          <em className="bg-linear-to-r from-pulse to-[#8fb8ff] bg-clip-text italic text-transparent">
            someone&rsquo;s awake.
          </em>
        </h1>

        <p
          className="animate-rise mt-6 max-w-md text-balance text-[15px] leading-relaxed text-muted sm:text-base"
          style={{ animationDelay: "160ms" }}
        >
          Every glowing dot is a real person online this second. Tap one to
          chat or call. No profiles, no history, no trace.
        </p>

        <div
          className="animate-rise mt-10 flex flex-col items-center gap-4"
          style={{ animationDelay: "240ms" }}
        >
          <button
            onClick={enter}
            disabled={locating}
            className="group relative inline-flex h-14 items-center gap-3 rounded-full bg-pulse pl-7 pr-6 text-[15px] font-semibold text-ink shadow-[0_0_0_1px_rgb(124_255_196/0.4),0_12px_40px_-8px_rgb(124_255_196/0.6)] transition duration-300 ease-out-expo hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgb(124_255_196/0.6),0_18px_50px_-8px_rgb(124_255_196/0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg focus-visible:ring-offset-4 focus-visible:ring-offset-ink active:translate-y-0 disabled:cursor-wait disabled:opacity-80"
          >
            {locating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
                Finding you…
              </>
            ) : (
              <>
                Drop onto the globe
                <span className="grid h-7 w-7 place-items-center rounded-full bg-ink/10 transition-transform duration-300 ease-out-expo group-hover:translate-x-0.5">
                  →
                </span>
              </>
            )}
          </button>

          {status === "error" && (
            <p
              role="alert"
              className="animate-rise max-w-sm rounded-2xl border border-ember/30 bg-ember/10 px-4 py-3 text-sm text-[#ffb3ba]"
            >
              {error}
            </p>
          )}
        </div>
      </div>

      <ul
        className="animate-fade relative z-10 mx-auto mb-[max(2rem,env(safe-area-inset-bottom))] flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-6 text-xs text-muted"
        style={{ animationDelay: "400ms" }}
      >
        <li className="flex items-center gap-2">
          <GhostIcon width={16} height={16} className="text-pulse" />
          No sign-up, ever
        </li>
        <li className="flex items-center gap-2">
          <PinIcon width={16} height={16} className="text-pulse" />
          Your dot is fuzzed 1–3 km
        </li>
        <li className="flex items-center gap-2">
          <ShieldIcon width={16} height={16} className="text-pulse" />
          Chats are peer-to-peer, never stored
        </li>
      </ul>
    </main>
  );
}
