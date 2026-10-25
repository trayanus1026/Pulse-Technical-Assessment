"use client";

import { InfoIcon } from "./icons";

export type ToastTone = "info" | "warn";

// Transient status line under the top bar. Re-keyed per message so the entry
// animation replays.
export default function Toast({
  text,
  tone,
}: {
  text: string;
  tone: ToastTone;
}) {
  return (
    <div
      role="status"
      className="glass animate-rise absolute left-1/2 top-[calc(5rem+env(safe-area-inset-top))] z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2.5 rounded-full py-2.5 pl-3.5 pr-4 text-sm text-fg"
    >
      <InfoIcon
        width={16}
        height={16}
        className={tone === "warn" ? "text-ember" : "text-pulse"}
      />
      {text}
    </div>
  );
}
