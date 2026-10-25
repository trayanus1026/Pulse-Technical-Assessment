import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { STALE_MS, SIGNAL_TTL_MS } from "@/lib/presence";
import { bearerToken, findSession, unauthorized } from "@/lib/session";
import type { PollResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/poll — the single endpoint that drives the live map. Authenticated
// by the session token, so only the owner can drain their own mailbox.
// It (1) heartbeats the caller, (2) reaps stale presence + orphan signals,
// (3) returns the filtered online peers plus the live conversation "threads"
// between them, and (4) drains this user's mailbox.
export async function GET(request: NextRequest) {
  const me = await findSession(bearerToken(request));
  // Unknown token: the session was reaped (e.g. the tab was throttled) or
  // never existed. The client re-joins with a fresh identity.
  if (!me) return unauthorized();

  const now = Date.now();
  const staleCutoff = new Date(now - STALE_MS);
  const signalCutoff = new Date(now - SIGNAL_TTL_MS);

  // 1) Heartbeat — refresh lastSeen for the caller only. updateMany (not
  // update) so a concurrent reap by another poller isn't a 500.
  const { count } = await prisma.presence.updateMany({
    where: { id: me.id },
    data: { lastSeen: new Date(now) },
  });
  if (count === 0) return unauthorized();

  // 2) Reap stale presence rows and orphaned signals (independent writes —
  // no atomicity needed, and avoids transactions over a PgBouncer pooler).
  // Anyone paired with / waiting on a reaped user is freed so they don't stay
  // "busy" forever.
  const stale = await prisma.presence.findMany({
    where: { lastSeen: { lt: staleCutoff } },
    select: { id: true },
  });
  if (stale.length > 0) {
    const staleIds = stale.map((s) => s.id);
    await prisma.presence.deleteMany({ where: { id: { in: staleIds } } });
    await prisma.presence.updateMany({
      where: { peerId: { in: staleIds } },
      data: { peerId: null },
    });
    await prisma.presence.updateMany({
      where: { pendingTo: { in: staleIds } },
      data: { pendingTo: null },
    });
  }
  await prisma.signal.deleteMany({ where: { createdAt: { lt: signalCutoff } } });

  // 3) Online peers, excluding self. Only public fields leave the server.
  const peers = await prisma.presence.findMany({
    where: {
      id: { not: me.id },
      lastSeen: { gte: staleCutoff },
    },
    select: { id: true, lat: true, lng: true, peerId: true },
  });

  // 4) Drain this user's mailbox: read, then delete exactly what we read so a
  // concurrently-inserted signal is never lost.
  const inbox = await prisma.signal.findMany({
    where: { toId: me.id },
    orderBy: { createdAt: "asc" },
  });
  if (inbox.length > 0) {
    await prisma.signal.deleteMany({
      where: { id: { in: inbox.map((s) => s.id) } },
    });
  }

  // Threads: every pair that is mutually connected right now (both rows point
  // at each other, so a half-finished accept never draws a line). Pairings
  // are already implied by the public busy flag; this just says which two.
  const partnerOf = new Map<string, string | null>(
    peers.map((p) => [p.id, p.peerId]),
  );
  partnerOf.set(me.id, me.peerId);
  const threads: [string, string][] = [];
  for (const [id, partner] of partnerOf) {
    if (partner && id < partner && partnerOf.get(partner) === id) {
      threads.push([id, partner]);
    }
  }

  const response: PollResponse = {
    peers: peers.map((p) => ({
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      busy: p.peerId !== null,
    })),
    threads,
    signals: inbox.map((s) => ({
      id: s.id,
      fromId: s.fromId,
      type: s.type as PollResponse["signals"][number]["type"],
      payload: s.payload,
      createdAt: s.createdAt.toISOString(),
    })),
  };

  return Response.json(response, { headers: { "Cache-Control": "no-store" } });
}
