import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson } from "@/lib/http";
import { bearerToken, findSession, unauthorized } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/leave — authenticated by the session token. Called via
// navigator.sendBeacon on tab close, which can't set headers, so the token may
// arrive in the (text/plain) body instead of the Authorization header.
export async function POST(request: NextRequest) {
  let token = bearerToken(request);
  if (!token) {
    const body = await readJson(request, 256);
    token = typeof body?.token === "string" ? body.token : null;
  }

  const me = await findSession(token);
  if (!me) return unauthorized();

  // Independent cleanup writes — no atomicity needed (and interactive
  // transactions are unreliable over a PgBouncer pooler).
  // Free whoever we were talking to / had a pending request with.
  await prisma.presence.updateMany({
    where: { peerId: me.id },
    data: { peerId: null },
  });
  await prisma.presence.updateMany({
    where: { pendingTo: me.id },
    data: { pendingTo: null },
  });
  await prisma.signal.deleteMany({
    where: { OR: [{ toId: me.id }, { fromId: me.id }] },
  });
  await prisma.presence.deleteMany({ where: { id: me.id } });

  return Response.json({ ok: true });
}
