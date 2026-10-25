"use client";

import { useEffect, useRef, useState } from "react";
import EntryGate from "./components/EntryGate";
import WorldMap from "./components/WorldMap";
import ConnectionPrompt from "./components/ConnectionPrompt";
import ChatPanel, { type ChatMessage } from "./components/ChatPanel";
import VideoPanel from "./components/VideoPanel";
import Toast, { type ToastTone } from "./components/Toast";
import WaitingPill from "./components/WaitingPill";
import { join, leave, poll, sendSignal } from "@/lib/api";
import { PeerSession, type DescType, type PeerControl } from "@/lib/webrtc";
import { POLL_INTERVAL_MS } from "@/lib/presence";
import { peerColor } from "@/lib/color";
import { distanceKm, formatDistance } from "@/lib/geo";
import { type PeerDot, type SignalMsg } from "@/lib/types";

type Conn =
  | { kind: "idle" }
  | { kind: "requesting"; peerId: string }
  | { kind: "incoming"; peerId: string }
  | { kind: "connecting"; peerId: string }
  | { kind: "connected"; peerId: string };

type VideoState = "none" | "requesting" | "incoming" | "active";

const REQUEST_TIMEOUT_MS = 30_000;

export default function Home() {
  const [phase, setPhase] = useState<"gate" | "live">("gate");
  const [sessionId] = useState(() => crypto.randomUUID());
  const [peers, setPeers] = useState<PeerDot[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [notice, setNotice] = useState<{
    id: number;
    text: string;
    tone: ToastTone;
  } | null>(null);
  const [requestStartedAt, setRequestStartedAt] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(
    null,
  );

  const [conn, _setConn] = useState<Conn>({ kind: "idle" });
  const connRef = useRef<Conn>(conn);
  const setConn = (c: Conn) => {
    connRef.current = c;
    _setConn(c);
  };

  const [video, _setVideo] = useState<VideoState>("none");
  const videoRef = useRef<VideoState>(video);
  const setVideo = (v: VideoState) => {
    videoRef.current = v;
    _setVideo(v);
  };

  const peerRef = useRef<PeerSession | null>(null);
  const locationRef = useRef<{ lat: number; lng: number } | null>(null);
  const msgId = useRef(0);
  const requestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeId = useRef(0);

  function showNotice(text: string, tone: ToastTone = "info") {
    // Restart the timer so a newer message isn't cut short by an older one.
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ id: noticeId.current++, text, tone });
    noticeTimer.current = setTimeout(() => setNotice(null), 3500);
  }

  function addMessage(mine: boolean, text: string) {
    setMessages((prev) => [...prev, { id: msgId.current++, mine, text }]);
  }

  function teardown(message?: string, tone: ToastTone = "info") {
    if (requestTimer.current) clearTimeout(requestTimer.current);
    peerRef.current?.close();
    peerRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
    setMessages([]);
    setConn({ kind: "idle" });
    if (message) showNotice(message, tone);
  }

  function startPeer(peerId: string, initiator: boolean) {
    // The peer link dropped without an "end" signal (tab closed, network
    // failure). Tell the server so both busy flags are cleared, then reset.
    const lost = (message: string) => {
      if (peerRef.current !== ps) return;
      void sendSignal(sessionId, peerId, "end");
      teardown(message, "warn");
    };
    const ps = new PeerSession(initiator, {
      onSignal: (type: DescType, payload: string) => {
        void sendSignal(sessionId, peerId, type, payload);
      },
      onChat: (text) => addMessage(false, text),
      onControl: (ctrl) => handleControl(ctrl),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onConnectionState: (state) => {
        if (state === "failed" || state === "closed") {
          lost("The connection dropped. Network trouble on one side.");
        }
      },
      onChannelOpen: () => {
        setConn({ kind: "connected", peerId });
      },
      onChannelClose: () => lost("The stranger drifted off."),
    });
    peerRef.current = ps;
  }

  function handleControl(ctrl: PeerControl) {
    const ps = peerRef.current;
    switch (ctrl) {
      case "video-request":
        if (videoRef.current === "none") setVideo("incoming");
        break;
      case "video-accept":
        if (videoRef.current === "requesting" && ps) {
          ps.startVideo()
            .then((stream) => {
              setLocalStream(stream);
              setVideo("active");
            })
            .catch(() => {
              setVideo("none");
              ps.sendControl("video-end");
              showNotice("Couldn't access your camera.", "warn");
            });
        }
        break;
      case "video-decline":
        if (videoRef.current === "requesting") {
          setVideo("none");
          showNotice("They'd rather keep it to text.");
        }
        break;
      case "video-end":
        ps?.stopVideo();
        setLocalStream(null);
        setRemoteStream(null);
        setVideo("none");
        break;
    }
  }

  function requestConnection(peerId: string) {
    if (connRef.current.kind !== "idle") {
      showNotice("Finish your current conversation first.");
      return;
    }
    if (peers.find((p) => p.id === peerId)?.busy) {
      showNotice("They're mid-conversation. Try someone else.");
      return;
    }
    setConn({ kind: "requesting", peerId });
    setRequestStartedAt(Date.now());
    void sendSignal(sessionId, peerId, "request");
    requestTimer.current = setTimeout(() => {
      if (
        connRef.current.kind === "requesting" &&
        connRef.current.peerId === peerId
      ) {
        void sendSignal(sessionId, peerId, "end");
        teardown("No answer this time. Someone else is out there.");
      }
    }, REQUEST_TIMEOUT_MS);
  }

  function cancelRequest() {
    if (connRef.current.kind === "requesting") {
      void sendSignal(sessionId, connRef.current.peerId, "end");
    }
    teardown();
  }

  function acceptIncoming() {
    if (connRef.current.kind !== "incoming") return;
    const peerId = connRef.current.peerId;
    startPeer(peerId, false);
    void sendSignal(sessionId, peerId, "accept");
    setConn({ kind: "connecting", peerId });
  }

  function declineIncoming() {
    if (connRef.current.kind !== "incoming") return;
    void sendSignal(sessionId, connRef.current.peerId, "decline");
    setConn({ kind: "idle" });
  }

  function endConnection() {
    const c = connRef.current;
    if (c.kind === "connecting" || c.kind === "connected") {
      void sendSignal(sessionId, c.peerId, "end");
    }
    teardown();
  }

  function startVideoRequest() {
    if (videoRef.current !== "none" || !peerRef.current) return;
    setVideo("requesting");
    peerRef.current.sendControl("video-request");
  }

  function acceptVideo() {
    const ps = peerRef.current;
    if (!ps) return;
    ps.startVideo()
      .then((stream) => {
        setLocalStream(stream);
        ps.sendControl("video-accept");
        setVideo("active");
      })
      .catch(() => {
        ps.sendControl("video-decline");
        setVideo("none");
        showNotice("Couldn't access your camera.", "warn");
      });
  }

  function declineVideo() {
    peerRef.current?.sendControl("video-decline");
    setVideo("none");
  }

  function cancelVideoRequest() {
    // "video-end" also dismisses the peer's pending video prompt.
    peerRef.current?.sendControl("video-end");
    setVideo("none");
  }

  function endVideo() {
    const ps = peerRef.current;
    ps?.stopVideo();
    ps?.sendControl("video-end");
    setLocalStream(null);
    setRemoteStream(null);
    setVideo("none");
  }

  function processSignal(sig: SignalMsg) {
    switch (sig.type) {
      case "request": {
        if (connRef.current.kind === "idle") {
          setConn({ kind: "incoming", peerId: sig.fromId });
        } else {
          void sendSignal(sessionId, sig.fromId, "decline");
        }
        break;
      }
      case "accept": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          startPeer(sig.fromId, true);
          setConn({ kind: "connecting", peerId: sig.fromId });
        }
        break;
      }
      case "decline": {
        const c = connRef.current;
        if (c.kind === "requesting" && c.peerId === sig.fromId) {
          if (requestTimer.current) clearTimeout(requestTimer.current);
          teardown("Not this time. Plenty of other dots out there.");
        }
        break;
      }
      case "offer":
      case "answer":
      case "ice": {
        const c = connRef.current;
        const peerId =
          c.kind === "connecting" || c.kind === "connected" ? c.peerId : null;
        if (peerRef.current && peerId === sig.fromId) {
          void peerRef.current.handleSignal(
            sig.type as DescType,
            sig.payload ?? "",
          );
        }
        break;
      }
      case "end": {
        const c = connRef.current;
        if (
          (c.kind === "incoming" ||
            c.kind === "connecting" ||
            c.kind === "connected") &&
          c.peerId === sig.fromId
        ) {
          if (c.kind === "incoming") {
            setConn({ kind: "idle" });
            showNotice("They changed their mind.");
          } else {
            teardown("The stranger said goodbye.");
          }
        }
        break;
      }
    }
  }

  const processSignalRef = useRef(processSignal);
  useEffect(() => {
    processSignalRef.current = processSignal;
  });

  useEffect(() => {
    if (phase !== "live" || !sessionId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const data = await poll(sessionId);
        if (!active) return;
        if (!data) {
          // Our presence row was reaped (e.g. the tab was throttled in the
          // background past STALE_MS) — re-join so we're visible again.
          const loc = locationRef.current;
          if (loc) await join(sessionId, loc.lat, loc.lng);
        } else {
          setPeers(data.peers);
          for (const s of data.signals) processSignalRef.current(s);
        }
      } catch {}
      if (active) timer = setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [phase, sessionId]);

  useEffect(() => {
    if (!sessionId || phase !== "live") return;
    const onLeave = () => leave(sessionId);
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [sessionId, phase]);

  async function handleReady(lat: number, lng: number) {
    locationRef.current = { lat, lng };
    setMyLocation({ lat, lng });
    await join(sessionId, lat, lng);
    setPhase("live");
  }

  if (phase === "gate") {
    return <EntryGate onReady={handleReady} />;
  }

  const inChat = conn.kind === "connecting" || conn.kind === "connected";

  // Identity + rough distance for whoever we're dealing with right now.
  const activePeerId = conn.kind === "idle" ? null : conn.peerId;
  const activePeer = activePeerId
    ? peers.find((p) => p.id === activePeerId)
    : undefined;
  const color = activePeerId ? peerColor(activePeerId) : "#7cffc4";
  const distanceLabel =
    activePeer && myLocation
      ? formatDistance(distanceKm(myLocation, activePeer))
      : null;

  return (
    <main className="fixed inset-0 overflow-hidden bg-ink">
      <WorldMap
        peers={peers}
        me={myLocation}
        onPeerClick={requestConnection}
        canConnect={conn.kind === "idle"}
        activePeerId={activePeerId}
      />

      {conn.kind === "idle" && !notice && (
        <p
          key={peers.length > 0 ? "hint" : "quiet"}
          className="glass animate-rise pointer-events-none absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-10 max-w-[calc(100vw-8rem)] -translate-x-1/2 truncate rounded-full px-4 py-2.5 text-center text-sm text-muted"
          style={{ animationDelay: "1.2s" }}
        >
          {peers.length > 0 ? (
            <>
              Tap a <span className="text-pulse">glowing dot</span> to say hi
            </>
          ) : (
            "It's quiet. Stay a moment, someone always drops in."
          )}
        </p>
      )}

      {notice && (
        <Toast key={notice.id} text={notice.text} tone={notice.tone} />
      )}

      {conn.kind === "requesting" && !notice && (
        <WaitingPill
          label="Reaching out…"
          color={color}
          startedAt={requestStartedAt}
          timeoutMs={REQUEST_TIMEOUT_MS}
          onCancel={cancelRequest}
        />
      )}

      {conn.kind === "incoming" && (
        <ConnectionPrompt
          title="Someone wants to talk"
          subtitle={
            distanceLabel
              ? `A stranger ${distanceLabel} tapped your dot.`
              : "A stranger tapped your dot."
          }
          color={color}
          acceptLabel="Say hi"
          declineLabel="Not now"
          onAccept={acceptIncoming}
          onDecline={declineIncoming}
        />
      )}

      {inChat && (
        <ChatPanel
          messages={messages}
          connected={conn.kind === "connected"}
          videoBusy={video !== "none"}
          color={color}
          distanceLabel={distanceLabel}
          onSend={(text) => {
            peerRef.current?.sendChat(text);
            addMessage(true, text);
          }}
          onStartVideo={startVideoRequest}
          onEnd={endConnection}
        />
      )}

      {video === "requesting" && !notice && (
        <WaitingPill
          label="Asking to turn on video…"
          color={color}
          onCancel={cancelVideoRequest}
        />
      )}

      {video === "incoming" && (
        <ConnectionPrompt
          title="Go face to face?"
          subtitle="The stranger wants to turn on video. Your camera stays off unless you accept."
          color={color}
          variant="video"
          acceptLabel="Turn on video"
          declineLabel="Keep texting"
          onAccept={acceptVideo}
          onDecline={declineVideo}
        />
      )}

      {video === "active" && (
        <VideoPanel
          localStream={localStream}
          remoteStream={remoteStream}
          color={color}
          onEnd={endVideo}
        />
      )}
    </main>
  );
}
