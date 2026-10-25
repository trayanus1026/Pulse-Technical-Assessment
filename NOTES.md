# Notes

## Phase 1: Make it run

I tested with two browser windows and read the code along the path a connection takes: join, poll, signal, then WebRTC. Every bug below came up while doing that.

- **Dots never disappeared.** The heartbeat in `/api/poll` ran `updateMany({ where: {} })`, so every poll refreshed *everyone's* `lastSeen`, and nobody ever went stale. It now updates only the caller.
- **Chat messages never showed up.** The sender sent `{ t: "msg" }` but the receiver only handled `{ t: "chat" }`. I made them match.
- **ICE candidates were dropped.** Queued candidates were flushed *before* `setRemoteDescription`, so `addIceCandidate` failed. I swapped the order.
- **Users stayed "busy" after hanging up.** `end` never cleared the busy flag. It now does.
- **Closing the tab left the other side hanging.** I listen to the data channel's `onclose`, which fires right away, unlike `connectionState`, which takes a long time to reach `failed`. On close the app sends `end` and resets the UI.
- **Ghost users.** If a background tab got throttled and reaped, it kept polling as an invisible user. Poll now reports "unknown session" and the client re-joins.
- **Fresh install didn't build.** Prisma 7 doesn't generate the client automatically, so I added `postinstall: prisma generate`.
- Smaller fixes:
  - Removed a hard-coded fake Mapbox token, so a missing token is obvious instead of failing silently.
  - Markers now move when a peer re-joins with a new offset.

## Phase 2: Make it good

The idea is a calm night-time planet, where the people are the only light on it.

- **Globe:** Mapbox globe projection with a dark atmosphere and stars. It starts zoomed out and flies down to you on load.
- **Dots:**
  - Each stranger gets a stable colour derived from their id, and the same colour shows on their dot, chat header and video badge.
  - Dots pulse at staggered times so the map breathes instead of blinking in sync.
  - Busy dots dim.
- **Entry screen:** a short pitch that explains the privacy promises up front (fuzzed location, no history, P2P) before asking for location.
- **Connect flow:**
  - The request prompt shows roughly how far away the stranger is.
  - "Waiting" pills have a countdown and a cancel button.
  - Toasts replace silent failures.
- **Chat:** glass panel, grouped message bubbles. It's a bottom sheet on mobile and a side panel on desktop.
- **Video:** full-bleed remote video, mirrored self-view, and mic/camera toggles.
- Respects `prefers-reduced-motion`, safe-area insets, keyboard focus, and Esc to dismiss.

## Phase 3: Make it secure

Ranked by impact:

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | Critical | The session id was both the public identifier and the only credential, and `/api/poll` handed everyone's id to everyone. Anyone could poll as you, steal your incoming offer and take over the call. | Fixed |
| 2 | High | Anyone could kick any user (`/leave`), overwrite their dot (`/join`), or forge `fromId` on signals. | Fixed |
| 3 | High | The server didn't track who was paired with whom. A forged `accept` could mark anyone busy, and anyone could inject SDP or ICE into someone else's call. | Fixed |
| 4 | Medium | No rate limits: request spam, signal floods, mailboxes that could grow without limit. | Fixed |
| 5 | Medium | Payloads weren't validated. Up to 64 KB of junk was stored, and malformed SDP could crash the receiver. | Fixed |
| 6 | Medium | Data-channel messages from the peer were trusted (no size cap, unknown commands passed through). | Fixed |
| 7 | Low | No security headers, and an unknown ngrok host was allowed in dev. | Fixed |
| 8 | Medium | WebRTC exposes each peer's IP address to the other, which gives away a rough location. | Not fixed: needs a TURN server with relay-only mode. |
| 9 | Low | Joining has no per-IP rate limit. | Not fixed: storing IPs goes against "no PII". I'd use a Vercel Firewall rule instead. |

How it's fixed:
- **Server-issued identity.** `/join` returns a public `id` and a secret `token`. Only `sha256(token)` is stored. The token stays in memory and travels as a Bearer header. The sender is always derived from the token, never from the request body.
- **The server checks pairing.** `peerId` and `pendingTo` columns track who is paired and who has a request out:
  - `accept` only works if that person actually requested you.
  - SDP and ICE only flow between an actual pair.
  - Pairing uses conditional `updateMany` calls, so two requests at once can't break it.
- **Limits:**
  - 120 signals per 10 seconds per user, counted by one atomic `UPDATE`.
  - A 2-second cooldown between connection requests.
  - At most 200 queued messages per mailbox.
  - Capped body sizes and strict SDP/ICE shape checks.
- **Cleanup.** Leaving or going stale now frees your partner as well.
- **Headers.** CSP (with the Mapbox hosts allowed), `frame-ancestors 'none'`, Permissions-Policy, HSTS, `nosniff`, no `X-Powered-By`.
- **One gotcha the tests caught.** Raw-query `Date` params are sent in the server's local time, but Prisma stores UTC, so the rate limiter never triggered on my machine (UTC+8). It would only have worked on Vercel by luck. I fixed it by converting to UTC explicitly.

I tested all of this with a 43-case attack script against a local database.

## Phase 4: Make it better

I built one feature for *safe* and one for *alive*.

### Veiled video (safe)
The classic problem with stranger video is what someone sees in the first few seconds. In Pulse, every call now starts veiled.

- **The blur happens on the sender's own device, before WebRTC.** Each frame is shrunk to a 24 px thumbnail and stretched back up. The sharp image never leaves the browser, so a modified client on the other side has nothing to unblur. A CSS blur on the receiver could be removed; this can't.
- **Consent is separate.** Each person unveils for themselves. If I unveil, you stay veiled until you choose otherwise.
- **The self-view is the outgoing stream,** so "Veiled · they see this" is literally true.
- **Unveiling swaps the track in place** (`replaceTrack`), with no renegotiation and no flicker. You can re-veil at any time.
- **Verified in a browser:** while veiled, the received stream had 0 hard edges; after unveiling it had about 11 per 1,000 pixels.

### Live threads (alive)
A dot only tells you someone is *online*. I wanted you to see people *talking*.

- **Every live conversation is a glowing great-circle arc** between the two dots, with a spark of light travelling along it.
- **Your own thread is in your partner's colour,** and the camera pulls back to show both ends when you connect. Seeing the line reach across an ocean is the moment I was going for.
- **New conversations elsewhere** pop up in a ticker ("Two strangers ~5,600 km apart just started talking") with a **Show me** button that flies the globe there.
- **Privacy:** the server returns only pairs where both people are actually connected to each other. That reveals nothing new, since busy status was already public.

### With more time
- A voice-only mode as a softer alternative to unveiling.
- A face-only blur (on-device segmentation), so the background shows but the face stays hidden.
- Group threads into clusters when zoomed out, so a busy globe stays readable.
- TURN with relay-only mode, to close the IP leak from Phase 3.
- Replace polling with a realtime channel (e.g. Postgres LISTEN/NOTIFY through a small edge service) once traffic justifies it.

## Running it

```bash
npm install
cp .env.example .env        # DATABASE_URL + NEXT_PUBLIC_MAPBOX_TOKEN
npx prisma migrate deploy   # or: npx prisma db push
npm run dev
```

Note: the Phase 3 migration clears the temporary presence and signal rows. That's fine, because nothing in them is meant to last.
