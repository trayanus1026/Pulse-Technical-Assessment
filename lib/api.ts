// Client-side helpers for talking to the coordination API.
import type { PollResponse, SignalType } from "@/lib/types";

// `id` is public (it's what other users see); `token` is the secret that
// proves we own it. The token lives only in memory — never in storage.
export interface Session {
  id: string;
  token: string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function join(lat: number, lng: number): Promise<Session> {
  const res = await fetch("/api/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng }),
  });
  if (!res.ok) throw new Error(`join failed: ${res.status}`);
  return res.json();
}

// Resolves to null when the server no longer knows this session (its presence
// row was reaped), signalling the caller to re-join.
export async function poll(token: string): Promise<PollResponse | null> {
  const res = await fetch("/api/poll", {
    cache: "no-store",
    headers: auth(token),
  });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`poll failed: ${res.status}`);
  return res.json();
}

// Resolves to whether the server accepted the signal (it rejects signals that
// don't fit the current connection state, or exceed rate limits).
export async function sendSignal(
  token: string,
  toId: string,
  type: SignalType,
  payload?: string,
): Promise<boolean> {
  try {
    const res = await fetch("/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth(token) },
      body: JSON.stringify({ toId, type, payload }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Fire-and-forget leave that survives the tab closing. sendBeacon can't set
// headers, so the token travels in the body.
export function leave(token: string): void {
  const body = JSON.stringify({ token });
  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    navigator.sendBeacon("/api/leave", body);
  } else {
    void fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }
}
