import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  MAILBOX_MAX,
  REQUEST_COOLDOWN_MS,
  SIGNAL_RATE_MAX,
  SIGNAL_RATE_WINDOW_MS,
} from "@/lib/presence";
import { badRequest, conflict, isUuid, readJson, tooMany } from "@/lib/http";
import { bearerToken, findSession, unauthorized } from "@/lib/session";
import { isValidPayload } from "@/lib/validate";
import type { SignalType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES: SignalType[] = [
  "request",
  "accept",
  "decline",
  "offer",
  "answer",
  "ice",
  "end",
];

// POST /api/signal — body { toId, type, payload? }, authenticated by token.
// The sender is derived from the token, never taken from the body. The server
// owns the connection state machine, so each signal is only accepted when it
// makes sense for the current relationship between the two users:
//
//   request  sender is free, target exists and is free → sender.pendingTo
//   accept   target has a pending request to sender     → pair both
//   decline  target has a pending request to sender     → clear it
//   end      paired → unpair both; or cancel own request
//   offer / answer / ice   only between paired users
export async function POST(request: NextRequest) {
  const me = await findSession(bearerToken(request));
  if (!me) return unauthorized();

  const body = await readJson(request, 20 * 1024);
  if (!body) return badRequest("invalid body");

  const { toId, type, payload } = body;
  if (!isUuid(toId) || toId === me.id) return badRequest("invalid recipient");
  if (typeof type !== "string" || !VALID_TYPES.includes(type as SignalType)) {
    return badRequest("invalid type");
  }
  const signalType = type as SignalType;
  if (!isValidPayload(signalType, payload)) return badRequest("invalid payload");

  if (!(await withinRateLimit(me.id))) return tooMany("slow down");

  const target = await prisma.presence.findUnique({ where: { id: toId } });

  switch (signalType) {
    case "request": {
      if (me.peerId) return conflict("already in a conversation");
      if (
        me.lastRequestAt &&
        Date.now() - me.lastRequestAt.getTime() < REQUEST_COOLDOWN_MS
      ) {
        return tooMany("request cooldown");
      }
      // Offline or already talking: tell the initiator straight away instead
      // of delivering the request.
      if (!target || target.peerId) {
        await deliver(toId, me.id, "decline", null);
        return Response.json({ ok: true, autoDeclined: true });
      }
      await prisma.presence.update({
        where: { id: me.id },
        data: { pendingTo: toId, lastRequestAt: new Date() },
      });
      break;
    }

    case "accept": {
      // Conditional updates make the pairing race-safe without transactions:
      // first claim the requester (only if they're still waiting on us)...
      const claimed = await prisma.presence.updateMany({
        where: { id: toId, pendingTo: me.id, peerId: null },
        data: { peerId: me.id, pendingTo: null },
      });
      if (claimed.count === 0) return conflict("no pending request");
      // ...then ourselves, rolling back if we were paired in the meantime.
      const self = await prisma.presence.updateMany({
        where: { id: me.id, peerId: null },
        data: { peerId: toId, pendingTo: null },
      });
      if (self.count === 0) {
        await prisma.presence.updateMany({
          where: { id: toId, peerId: me.id },
          data: { peerId: null },
        });
        return conflict("already in a conversation");
      }
      break;
    }

    case "decline": {
      const cleared = await prisma.presence.updateMany({
        where: { id: toId, pendingTo: me.id },
        data: { pendingTo: null },
      });
      if (cleared.count === 0) return conflict("no pending request");
      break;
    }

    case "end": {
      if (me.peerId === toId) {
        await prisma.presence.updateMany({
          where: { id: me.id, peerId: toId },
          data: { peerId: null },
        });
        await prisma.presence.updateMany({
          where: { id: toId, peerId: me.id },
          data: { peerId: null },
        });
      } else if (me.pendingTo === toId) {
        // Cancelled / timed-out request.
        await prisma.presence.updateMany({
          where: { id: me.id, pendingTo: toId },
          data: { pendingTo: null },
        });
      } else {
        return conflict("not connected");
      }
      break;
    }

    case "offer":
    case "answer":
    case "ice": {
      if (me.peerId !== toId || target?.peerId !== me.id) {
        return conflict("not connected");
      }
      break;
    }
  }

  if (!target) return Response.json({ ok: true, delivered: false });

  // Don't let a recipient's mailbox grow without bound (e.g. while their tab
  // is throttled and not polling).
  const queued = await prisma.signal.count({ where: { toId } });
  if (queued >= MAILBOX_MAX) return tooMany("recipient mailbox full");

  await deliver(me.id, toId, signalType, (payload as string | undefined) ?? null);
  return Response.json({ ok: true });
}

async function deliver(
  fromId: string,
  toId: string,
  type: SignalType,
  payload: string | null,
) {
  await prisma.signal.create({ data: { fromId, toId, type, payload } });
}

// Fixed-window counter stored on the presence row; a single atomic UPDATE so
// concurrent requests can't slip past the limit. Prisma stores DateTime
// columns as UTC `timestamp`, but raw Date params are sent in the server's
// local time — so pass ISO strings and convert to UTC explicitly.
async function withinRateLimit(id: string): Promise<boolean> {
  const now = new Date();
  const nowUtc = now.toISOString();
  const windowStartUtc = new Date(
    now.getTime() - SIGNAL_RATE_WINDOW_MS,
  ).toISOString();
  const rows = await prisma.$queryRaw<{ rateCount: number }[]>`
    UPDATE "Presence"
    SET "rateCount" = CASE
          WHEN "rateStart" < (${windowStartUtc}::timestamptz AT TIME ZONE 'UTC') THEN 1
          ELSE "rateCount" + 1 END,
        "rateStart" = CASE
          WHEN "rateStart" < (${windowStartUtc}::timestamptz AT TIME ZONE 'UTC')
            THEN (${nowUtc}::timestamptz AT TIME ZONE 'UTC')
          ELSE "rateStart" END
    WHERE "id" = ${id}
    RETURNING "rateCount"`;
  return rows.length > 0 && rows[0].rateCount <= SIGNAL_RATE_MAX;
}
