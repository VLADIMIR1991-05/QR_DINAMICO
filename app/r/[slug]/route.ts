import { db, ensureSchema } from "../../../lib/qr-db";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  await ensureSchema();
  const row = await db().prepare("SELECT destination FROM qr_codes WHERE slug = ?").bind(slug).first<{ destination: string }>();
  if (!row) return new Response("Código QR no encontrado", { status: 404 });
  await db().prepare("UPDATE qr_codes SET scans = scans + 1 WHERE slug = ?").bind(slug).run();
  return Response.redirect(row.destination, 302);
}
