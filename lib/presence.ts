// How long a presence row survives without a heartbeat (poll). After this the
// dot is treated as offline and removed — implements "dot disappears when the
// user leaves" even if their tab closed without a clean leave.
export const STALE_MS = 15_000;

// Orphan signals (mailbox messages never drained) are cleaned up after this.
export const SIGNAL_TTL_MS = 60_000;

// Abuse limits (enforced server-side).
export const SIGNAL_RATE_WINDOW_MS = 10_000;
export const SIGNAL_RATE_MAX = 120; // per window — ICE trickle + renegotiation fit easily
export const REQUEST_COOLDOWN_MS = 2_000; // between connection requests
export const MAILBOX_MAX = 200; // undelivered signals queued for one recipient

// Client poll interval. Kept here so client + server reason about the same cadence.
export const POLL_INTERVAL_MS = 1_500;
