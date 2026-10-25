// Server-side shape checks for relayed signal payloads. The server can't read
// chat or media, but it does relay SDP/ICE — make sure it only relays small,
// well-formed objects so a malicious sender can't crash or bloat the receiver.
import type { SignalType } from "@/lib/types";

const MAX_SDP = 16 * 1024;
const MAX_ICE = 2 * 1024;

export function isValidPayload(type: SignalType, payload: unknown): boolean {
  switch (type) {
    case "request":
    case "accept":
    case "decline":
    case "end":
      // Control signals carry nothing.
      return payload === undefined || payload === null;
    case "offer":
    case "answer": {
      if (typeof payload !== "string" || payload.length > MAX_SDP) return false;
      const desc = parse(payload);
      return (
        !!desc &&
        desc.type === type &&
        typeof desc.sdp === "string" &&
        Object.keys(desc).every((k) => k === "type" || k === "sdp")
      );
    }
    case "ice": {
      if (typeof payload !== "string" || payload.length > MAX_ICE) return false;
      const c = parse(payload);
      return (
        !!c &&
        typeof c.candidate === "string" &&
        (c.sdpMid === undefined || c.sdpMid === null || typeof c.sdpMid === "string") &&
        (c.sdpMLineIndex === undefined ||
          c.sdpMLineIndex === null ||
          Number.isInteger(c.sdpMLineIndex))
      );
    }
  }
}

function parse(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}
