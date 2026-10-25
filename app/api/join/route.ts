import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyPrivacyOffset, isValidLatLng } from "@/lib/geo";
import { badRequest, readJson } from "@/lib/http";
import { newSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/join — body { lat, lng } (raw coords).
// Creates a fresh session: the server picks the public id and a secret token,
// so a client can never claim (or overwrite) someone else's identity. Applies
// a 1–3 km privacy offset; raw coordinates are never stored.
export async function POST(request: NextRequest) {
  const body = await readJson(request, 1024);
  if (!body) return badRequest("invalid body");

  const { lat, lng } = body;
  if (!isValidLatLng(lat, lng)) return badRequest("invalid coordinates");

  const offset = applyPrivacyOffset(lat as number, lng as number);
  const { id, token, tokenHash } = newSession();

  await prisma.presence.create({
    data: {
      id,
      tokenHash,
      lat: offset.lat,
      lng: offset.lng,
      lastSeen: new Date(),
    },
  });

  return Response.json(
    { id, token },
    { headers: { "Cache-Control": "no-store" } },
  );
}
