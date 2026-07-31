import { db, ensureSchema, isSafeUrl } from "../../../../lib/qr-db";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return Response.json({ error: "Acceso requerido" }, { status: 401 });
  await ensureSchema();
  const row = await db().prepare("SELECT id, slug, name, destination, scans FROM qr_codes WHERE id = ? AND edit_token = ?")
    .bind(id, token).first<{ id: string; slug: string; name: string; destination: string; scans: number }>();
  if (!row) return Response.json({ error: "Código no encontrado" }, { status: 404 });
  const origin = new URL(request.url).origin;
  return Response.json({ ...row, shortUrl: `${origin}/r/${row.slug}` });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json()) as { token?: string; name?: string; destination?: string };
  const destination = body.destination?.trim() || "";
  if (!body.token || !isSafeUrl(destination)) return Response.json({ error: "Datos de actualización inválidos" }, { status: 400 });
  await ensureSchema();
  const result = await db().prepare("UPDATE qr_codes SET destination = ?, name = ?, updated_at = ? WHERE id = ? AND edit_token = ?")
    .bind(destination, (body.name?.trim() || "Mi código QR").slice(0, 80), new Date().toISOString(), id, body.token).run();
  if (!result.meta.changes) return Response.json({ error: "No autorizado o código inexistente" }, { status: 404 });
  const row = await db().prepare("SELECT slug, scans FROM qr_codes WHERE id = ?").bind(id).first<{ slug: string; scans: number }>();
  const origin = new URL(request.url).origin;
  return Response.json({ id, name: body.name, destination, scans: row?.scans || 0, shortUrl: `${origin}/r/${row?.slug}` });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return Response.json({ error: "Acceso requerido" }, { status: 401 });
  await ensureSchema();
  const result = await db().prepare("DELETE FROM qr_codes WHERE id = ? AND edit_token = ?").bind(id, token).run();
  if (!result.meta.changes) return Response.json({ error: "No autorizado o código inexistente" }, { status: 404 });
  return Response.json({ success: true });
}
