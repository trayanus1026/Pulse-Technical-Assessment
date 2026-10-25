import { createVeil, type Veil } from "./veil";

export type DescType = "offer" | "answer" | "ice";
export type PeerControl =
  | "video-request"
  | "video-accept"
  | "video-decline"
  | "video-end"
  // The sender's own veil state, so the other side can explain the blur.
  | "veil-on"
  | "veil-off";

interface PeerCallbacks {
  onSignal: (type: DescType, payload: string) => void;
  onChat: (text: string) => void;
  onControl: (ctrl: PeerControl) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onConnectionState: (state: RTCPeerConnectionState) => void;
  onChannelOpen: () => void;
  onChannelClose: () => void;
}

export const MAX_CHAT_LENGTH = 2000;
const MAX_WIRE_MESSAGE = 8 * 1024;
const CONTROLS: PeerControl[] = [
  "video-request",
  "video-accept",
  "video-decline",
  "video-end",
  "veil-on",
  "veil-off",
];

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

export class PeerSession {
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private readonly polite: boolean;
  private makingOffer = false;
  private ignoreOffer = false;
  // Raw camera + mic. The camera track is only ever sent once unveiled.
  private rawStream: MediaStream | null = null;
  private veil: Veil | null = null;
  private videoSender: RTCRtpSender | null = null;
  private veiled = true;
  private closed = false;
  private readonly cb: PeerCallbacks;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(initiator: boolean, cb: PeerCallbacks) {
    this.cb = cb;
    this.polite = !initiator;
    this.pc = new RTCPeerConnection(ICE_CONFIG);

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.cb.onSignal("ice", JSON.stringify(candidate));
      }
    };

    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        if (this.pc.localDescription) {
          this.cb.onSignal("offer", JSON.stringify(this.pc.localDescription));
        }
      } finally {
        this.makingOffer = false;
      }
    };

    this.pc.ontrack = ({ streams }) => {
      this.cb.onRemoteStream(streams[0] ?? null);
    };

    this.pc.onconnectionstatechange = () => {
      this.cb.onConnectionState(this.pc.connectionState);
    };

    if (initiator) {
      this.dc = this.pc.createDataChannel("chat");
      this.wireDataChannel(this.dc);
    } else {
      this.pc.ondatachannel = (e) => {
        this.dc = e.channel;
        this.wireDataChannel(this.dc);
      };
    }
  }

  private wireDataChannel(dc: RTCDataChannel) {
    dc.onopen = () => this.cb.onChannelOpen();
    // Fires promptly when the peer closes their tab; connectionState can take
    // much longer to reach "failed".
    dc.onclose = () => {
      if (!this.closed) this.cb.onChannelClose();
    };
    // Everything arriving here comes from an anonymous stranger: cap sizes and
    // only accept known message shapes.
    dc.onmessage = (e) => {
      if (typeof e.data !== "string" || e.data.length > MAX_WIRE_MESSAGE) return;
      try {
        const msg = JSON.parse(e.data);
        if (
          msg.t === "chat" &&
          typeof msg.text === "string" &&
          msg.text.trim() &&
          msg.text.length <= MAX_CHAT_LENGTH
        ) {
          this.cb.onChat(msg.text);
        } else if (msg.t === "ctrl" && CONTROLS.includes(msg.ctrl)) {
          this.cb.onControl(msg.ctrl);
        }
      } catch {}
    };
  }

  async handleSignal(type: DescType, payload: string) {
    try {
      await this.applySignal(type, payload);
    } catch {
      // Malformed or out-of-order SDP/ICE must not crash the session; perfect
      // negotiation recovers from transient glare on the next exchange.
    }
  }

  private async applySignal(type: DescType, payload: string) {
    if (this.closed) return;
    const data = JSON.parse(payload);

    if (type === "ice") {
      if (!this.pc.remoteDescription) {
        this.pendingCandidates.push(data);
        return;
      }
      try {
        await this.pc.addIceCandidate(data);
      } catch {}
      return;
    }

    const desc = data as RTCSessionDescriptionInit;
    const offerCollision =
      desc.type === "offer" &&
      (this.makingOffer || this.pc.signalingState !== "stable");
    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) return;

    // Candidates can only be added once a remote description exists, so set it
    // first and then drain anything that arrived ahead of the SDP.
    await this.pc.setRemoteDescription(desc);
    await this.flushPendingCandidates();
    if (desc.type === "offer") {
      await this.pc.setLocalDescription();
      if (this.pc.localDescription) {
        this.cb.onSignal("answer", JSON.stringify(this.pc.localDescription));
      }
    }
  }

  private async flushPendingCandidates() {
    if (this.pendingCandidates.length === 0) return;
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) {
      try {
        await this.pc.addIceCandidate(candidate);
      } catch {}
    }
  }

  sendChat(text: string) {
    this.safeSend({ t: "chat", text: text.slice(0, MAX_CHAT_LENGTH) });
  }

  sendControl(ctrl: PeerControl) {
    this.safeSend({ t: "ctrl", ctrl });
  }

  private safeSend(obj: unknown) {
    if (this.dc && this.dc.readyState === "open") {
      this.dc.send(JSON.stringify(obj));
    }
  }

  // Starts the camera *veiled*: WebRTC only ever gets the blurred track until
  // the user explicitly unveils. Resolves to the stream to show as self-view,
  // i.e. exactly what the stranger is receiving.
  async startVideo(): Promise<MediaStream> {
    if (!this.rawStream) {
      const raw = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      if (this.closed) {
        for (const track of raw.getTracks()) track.stop();
        throw new Error("session closed");
      }
      this.rawStream = raw;
      const cam = raw.getVideoTracks()[0];
      this.veil = cam ? createVeil(cam) : null;
      this.veiled = true;
      for (const track of raw.getAudioTracks()) this.pc.addTrack(track, raw);
      if (this.veil) this.videoSender = this.pc.addTrack(this.veil.track, raw);
    }
    return this.outgoingStream();
  }

  // Swaps the outgoing camera track in place (no renegotiation) and tells the
  // peer. Resolves to the new self-view stream.
  async setVeiled(veiled: boolean): Promise<MediaStream | null> {
    const cam = this.rawStream?.getVideoTracks()[0];
    if (!this.rawStream || !this.veil || !this.videoSender || !cam) return null;
    if (veiled !== this.veiled) {
      await this.videoSender.replaceTrack(veiled ? this.veil.track : cam);
      this.veiled = veiled;
      this.sendControl(veiled ? "veil-on" : "veil-off");
    }
    return this.outgoingStream();
  }

  // Applied to both the raw and the veiled track so the state survives
  // swapping between them.
  setTrackEnabled(kind: "audio" | "video", enabled: boolean) {
    const tracks =
      kind === "audio"
        ? (this.rawStream?.getAudioTracks() ?? [])
        : [
            ...(this.rawStream?.getVideoTracks() ?? []),
            ...(this.veil ? [this.veil.track] : []),
          ];
    for (const track of tracks) track.enabled = enabled;
  }

  private outgoingStream(): MediaStream {
    const raw = this.rawStream!;
    const video = this.veiled && this.veil ? this.veil.track : raw.getVideoTracks()[0];
    return new MediaStream([...(video ? [video] : []), ...raw.getAudioTracks()]);
  }

  stopVideo() {
    if (this.rawStream) {
      this.veil?.stop();
      for (const track of this.rawStream.getTracks()) track.stop();
      for (const sender of this.pc.getSenders()) {
        if (sender.track) {
          try {
            this.pc.removeTrack(sender);
          } catch {}
        }
      }
      this.rawStream = null;
      this.veil = null;
      this.videoSender = null;
      this.veiled = true;
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.stopVideo();
    if (this.dc) {
      try {
        this.dc.close();
      } catch {}
    }
    try {
      this.pc.close();
    } catch {}
  }
}
