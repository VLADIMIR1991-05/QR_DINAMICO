import { randomUUID } from "node:crypto";
import { db, ensureSchema, isSafeUrl } from "../../../lib/qr-db";

export async function POST(request: Request) {
  const body = (await request.json()) as { name?: string; destination?: string };
  const name = body.name?.trim() || "Mi código QR";
  const destination = body.destination?.trim() || "";
  if (!isSafeUrl(destination)) return Response.json({ error: "Ingresa una URL válida que comience con http:// o https://" }, { status: 400 });
  await ensureSchema();
  const id = randomUUID();
  const slug = randomUUID().replaceAll("-", "").slice(0, 10);
  const token = randomUUID();
  const now = new Date().toISOString();
  await db().prepare("INSERT INTO qr_codes (id, slug, name, destination, edit_token, scans, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)")
    .bind(id, slug, name.slice(0, 80), destination, token, now, now).run();
  const origin = new URL(request.url).origin;
  return Response.json({ id, slug, name, destination, token, scans: 0, shortUrl: `${origin}/r/${slug}` }, { status: 201 });
}
