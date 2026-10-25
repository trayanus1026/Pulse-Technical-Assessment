// Server-only session helpers.
//
// A session has two identifiers:
//   - `id`    public, shown to everyone on the map, used to address signals.
//   - `token` secret bearer credential, known only to the owning tab.
// Only sha256(token) is stored, so a database leak can't be replayed, and
// knowing someone's public id grants nothing.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export function newSession(): { id: string; token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { id: randomUUID(), token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// 32 random bytes → 43 base64url chars.
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function bearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return TOKEN_RE.test(token) ? token : null;
}

export async function findSession(token: string | null | undefined) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  return prisma.presence.findUnique({ where: { tokenHash: hashToken(token) } });
}

export const unauthorized = () =>
  Response.json({ error: "unknown session" }, { status: 401 });
