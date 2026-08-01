import { currentAccount } from "../../../../lib/auth";
import { db, ensureSchema, isSafeUrl } from "../../../../lib/qr-db";

async function allowed(request: Request, id: string) {
  await ensureSchema();
  const account = await currentAccount(request);
  if (account) {
    const row = await db().prepare("SELECT account_id FROM qr_codes WHERE id = ?").bind(id).first<{ account_id: string }>();
    if (row && (account.role === "master" || row.account_id === account.id)) return true;
  }
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return false;
  return Boolean(await db().prepare("SELECT id FROM qr_codes WHERE id = ? AND edit_token = ?").bind(id, token).first());
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!await allowed(request, id)) return Response.json({ error: "Código no encontrado o sin acceso" }, { status: 404 });
  const row = await db().prepare("SELECT id, slug, name, destination, scans, account_id FROM qr_codes WHERE id = ?")
    .bind(id).first<{ id: string; slug: string; name: string; destination: string; scans: number; account_id: string }>();
  if (!row) return Response.json({ error: "Código no encontrado" }, { status: 404 });
  return Response.json({ ...row, shortUrl: `${new URL(request.url).origin}/r/${row.slug}` });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!await allowed(request, id)) return Response.json({ error: "Código no encontrado o sin acceso" }, { status: 404 });
  const body = (await request.json()) as { name?: string; destination?: string };
  const destination = body.destination?.trim() || "";
  if (!isSafeUrl(destination)) return Response.json({ error: "Datos de actualización inválidos" }, { status: 400 });
  await db().prepare("UPDATE qr_codes SET destination = ?, name = ?, updated_at = ? WHERE id = ?")
    .bind(destination, (body.name?.trim() || "Mi código QR").slice(0, 80), new Date().toISOString(), id).run();
  const row = await db().prepare("SELECT slug, scans, account_id FROM qr_codes WHERE id = ?").bind(id).first<{ slug: string; scans: number; account_id: string }>();
  return Response.json({ id, name: body.name, destination, scans: row?.scans || 0, account_id: row?.account_id, shortUrl: `${new URL(request.url).origin}/r/${row?.slug}` });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!await allowed(request, id)) return Response.json({ error: "Código no encontrado o sin acceso" }, { status: 404 });
  await db().prepare("DELETE FROM qr_codes WHERE id = ?").bind(id).run();
  return Response.json({ success: true });
}
