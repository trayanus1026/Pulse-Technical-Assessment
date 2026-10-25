"use client";

import { useEffect, useRef, useState } from "react";
import {
  EyeIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  VeilIcon,
  VideoIcon,
  VideoOffIcon,
} from "./icons";

export default function VideoPanel({
  localStream,
  remoteStream,
  color,
  veiled,
  remoteVeiled,
  onToggleVeil,
  onTrackEnabled,
  onEnd,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  color: string;
  // Our own veil (what the stranger receives) and theirs (informational: the
  // blur is applied on their device, so there's nothing to undo here).
  veiled: boolean;
  remoteVeiled: boolean;
  onToggleVeil: () => void;
  onTrackEnabled: (kind: "audio" | "video", enabled: boolean) => void;
  onEnd: () => void;
}) {
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  useEffect(() => {
    if (localRef.current && localRef.current.srcObject !== localStream) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteRef.current.srcObject !== remoteStream) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Muting just disables the local track — no renegotiation needed.
  function toggleMic() {
    const next = !micOn;
    onTrackEnabled("audio", next);
    setMicOn(next);
  }

  function toggleCam() {
    const next = !camOn;
    onTrackEnabled("video", next);
    setCamOn(next);
  }

  const dockBtn =
    "grid h-14 w-14 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pulse";

  return (
    <div className="animate-fade absolute inset-0 z-30 bg-ink">
      {/* Remote, full-bleed */}
      <video
        ref={remoteRef}
        autoPlay
        playsInline
        className="h-full w-full object-cover"
      />
      {!remoteStream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
          <span className="relative grid h-24 w-24 place-items-center">
            <span
              className="absolute inset-0 m-auto h-12 w-12 animate-sonar rounded-full"
              style={{ background: color, opacity: 0.5 }}
            />
            <span
              className="absolute inset-0 m-auto h-12 w-12 animate-sonar rounded-full"
              style={{ background: color, opacity: 0.5, animationDelay: "1.2s" }}
            />
            <span
              className="relative h-12 w-12 rounded-full"
              style={{
                background: `radial-gradient(circle at 35% 30%, #fff, ${color} 60%)`,
                boxShadow: `0 0 30px 4px ${color}`,
              }}
            />
          </span>
          <p className="font-display text-2xl italic text-muted">
            Waiting for their camera…
          </p>
        </div>
      )}

      {remoteStream && (
        <div
          key={remoteVeiled ? "veiled" : "clear"}
          className="glass animate-rise pointer-events-none absolute left-1/2 top-[calc(4.5rem+env(safe-area-inset-top))] z-10 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-xs text-muted sm:top-8"
        >
          {remoteVeiled ? (
            <>
              <VeilIcon width={16} height={16} className="shrink-0 text-fg" />
              <span className="truncate">
                The stranger is veiled. They&apos;ll unveil when they&apos;re
                comfortable.
              </span>
            </>
          ) : (
            <>
              <EyeIcon width={16} height={16} className="shrink-0 text-pulse" />
              <span className="truncate">The stranger unveiled</span>
            </>
          )}
        </div>
      )}

      {/* Top & bottom scrims for legibility over any video */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-linear-to-b from-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-black/70 to-transparent" />

      <div className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex items-center gap-2.5 sm:left-6 sm:top-6">
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}
        />
        <span className="font-display text-2xl leading-none text-fg">Stranger</span>
        <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted">
          P2P · not recorded
        </span>
      </div>

      {/* Self-view, mirrored like a real mirror */}
      <div className="animate-pop absolute right-4 top-[calc(3.5rem+env(safe-area-inset-top))] aspect-[3/4] w-28 overflow-hidden rounded-2xl border border-white/15 bg-[#10121c] shadow-2xl sm:right-6 sm:top-6 sm:w-40">
        <video
          ref={localRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full -scale-x-100 object-cover transition-opacity ${camOn ? "opacity-100" : "opacity-0"}`}
        />
        {!camOn && (
          <div className="absolute inset-0 grid place-items-center text-faint">
            <VideoOffIcon />
          </div>
        )}
        {/* The self-view is the outgoing stream itself, so this is literally
            what the stranger sees. */}
        <span
          className={`absolute inset-x-1.5 bottom-1.5 rounded-full px-2 py-1 text-center font-mono text-[9px] uppercase tracking-widest backdrop-blur-sm ${veiled ? "bg-black/50 text-fg" : "bg-pulse/90 text-ink"}`}
        >
          {veiled ? "Veiled · they see this" : "Visible"}
        </span>
      </div>

      {/* Control dock */}
      <div className="glass animate-sheet absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full p-2.5">
        <button
          onClick={toggleMic}
          aria-pressed={!micOn}
          aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
          className={`${dockBtn} ${micOn ? "bg-white/[0.08] text-fg hover:bg-white/[0.14]" : "bg-fg text-ink"}`}
        >
          {micOn ? <MicIcon /> : <MicOffIcon />}
        </button>
        <button
          onClick={toggleCam}
          aria-pressed={!camOn}
          aria-label={camOn ? "Turn camera off" : "Turn camera on"}
          className={`${dockBtn} ${camOn ? "bg-white/[0.08] text-fg hover:bg-white/[0.14]" : "bg-fg text-ink"}`}
        >
          {camOn ? <VideoIcon /> : <VideoOffIcon />}
        </button>
        <button
          onClick={onToggleVeil}
          aria-pressed={!veiled}
          aria-label={veiled ? "Unveil: show your face clearly" : "Veil: blur your video again"}
          title={veiled ? "Unveil" : "Veil again"}
          className={
            veiled
              ? "flex h-14 items-center gap-2 rounded-full bg-pulse px-5 font-medium text-ink shadow-[0_10px_30px_-8px_rgb(124_255_196/0.7)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg"
              : `${dockBtn} bg-white/[0.08] text-fg hover:bg-white/[0.14]`
          }
        >
          {veiled ? (
            <>
              <EyeIcon />
              <span className="text-sm">Unveil</span>
            </>
          ) : (
            <VeilIcon />
          )}
        </button>
        <button
          onClick={onEnd}
          aria-label="End video and return to chat"
          title="End video (back to chat)"
          className={`${dockBtn} w-20 bg-ember text-white shadow-[0_10px_30px_-8px_rgb(255_93_108/0.8)] hover:brightness-110 focus-visible:ring-ember`}
        >
          <PhoneOffIcon />
        </button>
      </div>
    </div>
  );
}
