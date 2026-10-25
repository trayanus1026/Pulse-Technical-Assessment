"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneOffIcon, SendIcon, ShieldIcon, VideoIcon } from "./icons";

export interface ChatMessage {
  id: number;
  mine: boolean;
  text: string;
}

const MAX_LEN = 2000;

export default function ChatPanel({
  messages,
  connected,
  videoBusy,
  color,
  distanceLabel,
  onSend,
  onStartVideo,
  onEnd,
}: {
  messages: ChatMessage[];
  connected: boolean;
  videoBusy: boolean;
  color: string;
  distanceLabel: string | null;
  onSend: (text: string) => void;
  onStartVideo: () => void;
  onEnd: () => void;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Jump straight into typing once the peer link is up.
  useEffect(() => {
    if (connected) inputRef.current?.focus();
  }, [connected]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text);
    setDraft("");
  }

  return (
    <aside
      aria-label="Chat with stranger"
      className="glass animate-sheet absolute inset-x-0 bottom-0 z-20 flex h-[78dvh] flex-col rounded-t-[28px] text-fg md:inset-x-auto md:bottom-6 md:right-6 md:top-24 md:h-auto md:w-[400px] md:animate-rise md:rounded-[28px]"
    >
      {/* Grab handle (mobile) */}
      <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/15 md:hidden" />

      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <span className="relative grid h-10 w-10 shrink-0 place-items-center">
          {connected && (
            <span
              className="absolute inset-0 m-auto h-6 w-6 animate-sonar rounded-full"
              style={{ background: color, opacity: 0.45 }}
            />
          )}
          <span
            className="relative h-6 w-6 rounded-full"
            style={{
              background: `radial-gradient(circle at 35% 30%, #fff, ${color} 60%)`,
              boxShadow: `0 0 16px 2px ${color}`,
            }}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none">Stranger</p>
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted">
            {connected ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-pulse" />
                Connected{distanceLabel ? ` · ${distanceLabel}` : ""}
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted" />
                Opening a private line…
              </>
            )}
          </p>
        </div>
        <button
          onClick={onStartVideo}
          disabled={!connected || videoBusy}
          aria-label="Start video call"
          title="Start video call"
          className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white/[0.04] text-fg transition hover:border-pulse/40 hover:text-pulse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse disabled:pointer-events-none disabled:opacity-35"
        >
          <VideoIcon />
        </button>
        <button
          onClick={onEnd}
          aria-label="End conversation"
          title="End conversation"
          className="grid h-10 w-10 place-items-center rounded-full bg-ember/15 text-ember transition hover:bg-ember hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
        >
          <PhoneOffIcon />
        </button>
      </header>

      <div
        className="scroll-thin flex-1 overflow-y-auto px-4 py-5"
        aria-live="polite"
      >
        <div className="mx-auto mb-5 flex max-w-[16rem] flex-col items-center gap-2 text-center">
          <ShieldIcon width={18} height={18} className="text-pulse/80" />
          <p className="text-xs leading-relaxed text-faint">
            This chat runs directly between you two. Nothing touches our
            servers, and it vanishes when either of you leaves.
          </p>
        </div>

        {messages.length === 0 && connected && (
          <p className="animate-fade mt-10 text-center font-display text-2xl italic text-muted">
            Say hello 👋
          </p>
        )}

        <ul className="flex flex-col">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const firstOfGroup = !prev || prev.mine !== m.mine;
            const lastOfGroup = !next || next.mine !== m.mine;
            return (
              <li
                key={m.id}
                className={`animate-rise flex ${m.mine ? "justify-end" : "justify-start"} ${firstOfGroup ? "mt-3" : "mt-1"}`}
              >
                <span
                  className={`max-w-[80%] whitespace-pre-wrap break-words px-4 py-2.5 text-[15px] leading-snug ${
                    m.mine
                      ? `bg-linear-to-br from-pulse to-pulse-deep text-ink ${lastOfGroup ? "rounded-[20px] rounded-br-md" : "rounded-[20px]"}`
                      : `border border-line bg-white/[0.06] text-fg ${lastOfGroup ? "rounded-[20px] rounded-bl-md" : "rounded-[20px]"}`
                  }`}
                >
                  {m.text}
                </span>
              </li>
            );
          })}
        </ul>
        <div ref={endRef} />
      </div>

      <form
        onSubmit={submit}
        className="flex items-center gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? "Write something kind…" : "Connecting…"}
          disabled={!connected}
          maxLength={MAX_LEN}
          aria-label="Message"
          className="h-12 flex-1 rounded-full border border-line bg-white/[0.04] px-5 text-[15px] text-fg outline-none transition placeholder:text-faint focus:border-pulse/50 focus:bg-white/[0.06] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!connected || !draft.trim()}
          aria-label="Send"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-pulse text-ink transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg disabled:bg-white/[0.06] disabled:text-faint"
        >
          <SendIcon />
        </button>
      </form>
    </aside>
  );
}
