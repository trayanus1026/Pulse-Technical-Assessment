"use client";

import { useEffect, useRef, useState } from "react";
import {
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  VideoIcon,
  VideoOffIcon,
} from "./icons";

export default function VideoPanel({
  localStream,
  remoteStream,
  color,
  onEnd,
}: {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  color: string;
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
    localStream?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }

  function toggleCam() {
    const next = !camOn;
    localStream?.getVideoTracks().forEach((t) => (t.enabled = next));
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
