import { requireMaster } from "../../../../../lib/auth";
import { db } from "../../../../../lib/qr-db";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireMaster(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (id === "master") return Response.json({ error: "La cuenta maestra no puede suspenderse" }, { status: 400 });
  const body = await request.json() as { status?: string; name?: string; maxQr?: number; expiresAt?: string | null };
  const current = await db().prepare("SELECT name, status, max_qr, expires_at FROM qr_accounts WHERE id = ? AND role = 'license'").bind(id).first<{
    name: string; status: string; max_qr: number; expires_at: string | null;
  }>();
  if (!current) return Response.json({ error: "Licencia no encontrada" }, { status: 404 });
  const status = body.status === "suspended" ? "suspended" : body.status === "active" ? "active" : current.status;
  const maxQr = body.maxQr ? Math.max(1, Math.min(10000, Number(body.maxQr))) : current.max_qr;
  await db().prepare("UPDATE qr_accounts SET name = ?, status = ?, max_qr = ?, expires_at = ?, updated_at = ? WHERE id = ?")
    .bind((body.name || current.name).trim().slice(0, 80), status, maxQr, body.expiresAt === undefined ? current.expires_at : body.expiresAt, new Date().toISOString(), id).run();
  return Response.json({ success: true });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireMaster(request);
  if (auth.response) return auth.response;
  const { id } = await context.params;
  if (id === "master") return Response.json({ error: "La cuenta maestra no puede eliminarse" }, { status: 400 });
  await db().prepare("UPDATE qr_codes SET account_id = 'master' WHERE account_id = ?").bind(id).run();
  await db().prepare("DELETE FROM qr_sessions WHERE account_id = ?").bind(id).run();
  const result = await db().prepare("DELETE FROM qr_accounts WHERE id = ? AND role = 'license'").bind(id).run();
  if (!result.meta.changes) return Response.json({ error: "Licencia no encontrada" }, { status: 404 });
  return Response.json({ success: true });
}
