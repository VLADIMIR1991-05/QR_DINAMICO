import { randomUUID } from "node:crypto";
import { requireAccount } from "../../../lib/auth";
import { db, isSafeUrl } from "../../../lib/qr-db";

export async function GET(request: Request) {
  const auth = await requireAccount(request);
  if (auth.response || !auth.account) return auth.response;
  const origin = new URL(request.url).origin;
  const query = auth.account.role === "master"
    ? "SELECT id, slug, name, destination, scans, account_id FROM qr_codes ORDER BY created_at DESC"
    : "SELECT id, slug, name, destination, scans, account_id FROM qr_codes WHERE account_id = ? ORDER BY created_at DESC";
  const result = auth.account.role === "master"
    ? await db().prepare(query).all()
    : await db().prepare(query).bind(auth.account.id).all();
  return Response.json({ codes: result.results.map((row) => ({ ...row, shortUrl: `${origin}/r/${row.slug}` })) });
}

export async function POST(request: Request) {
  const auth = await requireAccount(request);
  if (auth.response || !auth.account) return auth.response;
  const body = (await request.json()) as { name?: string; destination?: string };
  const name = body.name?.trim() || "Mi código QR";
  const destination = body.destination?.trim() || "";
  if (!isSafeUrl(destination)) return Response.json({ error: "Ingresa una URL válida que comience con http:// o https://" }, { status: 400 });
  const count = await db().prepare("SELECT COUNT(*) AS total FROM qr_codes WHERE account_id = ?").bind(auth.account.id).first<{ total: number }>();
  if ((count?.total || 0) >= auth.account.max_qr) return Response.json({ error: "Esta licencia alcanzó su límite de códigos QR" }, { status: 403 });
  const id = randomUUID();
  const slug = randomUUID().replaceAll("-", "").slice(0, 10);
  const token = randomUUID();
  const now = new Date().toISOString();
  await db().prepare(`INSERT INTO qr_codes
    (id, slug, name, destination, edit_token, scans, created_at, updated_at, account_id)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`)
    .bind(id, slug, name.slice(0, 80), destination, token, now, now, auth.account.id).run();
  const origin = new URL(request.url).origin;
  return Response.json({ id, slug, name, destination, scans: 0, account_id: auth.account.id, shortUrl: `${origin}/r/${slug}` }, { status: 201 });
}
