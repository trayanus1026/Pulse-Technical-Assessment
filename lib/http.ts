// Parse a JSON request body with a size cap. Returns undefined on oversize or
// malformed input. Reads as text so sendBeacon (text/plain) bodies work too.
export async function readJson(
  request: Request,
  maxBytes: number,
): Promise<Record<string, unknown> | undefined> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) return undefined;
  const text = await request.text();
  if (text.length > maxBytes) return undefined;
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

export const badRequest = (error: string) =>
  Response.json({ error }, { status: 400 });

export const conflict = (error: string) =>
  Response.json({ error }, { status: 409 });

export const tooMany = (error: string) =>
  Response.json({ error }, { status: 429 });

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && UUID_RE.test(v);
