import { randomUUID } from "node:crypto";
import { currentAccount, hashValue, SESSION_COOKIE } from "../../../../lib/auth";
import { db, ensureSchema } from "../../../../lib/qr-db";

export async function GET(request: Request) {
  const account = await currentAccount(request);
  if (!account) return Response.json({ error: "Sin sesión" }, { status: 401 });
  return Response.json({ account });
}

export async function POST(request: Request) {
  await ensureSchema();
  const body = await request.json() as { license?: string };
  const license = body.license?.trim() || "";
  if (license.length < 12) return Response.json({ error: "Licencia inválida" }, { status: 400 });
  const now = new Date();
  const account = await db().prepare(`SELECT id, name, email, role, status, max_qr, expires_at
    FROM qr_accounts WHERE license_hash = ?`).bind(hashValue(license)).first<{
      id: string; name: string; email: string; role: string; status: string; max_qr: number; expires_at: string | null;
    }>();
  if (!account) return Response.json({ error: "Licencia incorrecta" }, { status: 401 });
  if (account.status !== "active") return Response.json({ error: "Esta licencia está suspendida" }, { status: 403 });
  if (account.expires_at && account.expires_at <= now.toISOString()) return Response.json({ error: "Esta licencia ha vencido" }, { status: 403 });
  const token = randomUUID() + randomUUID();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await db().prepare("INSERT INTO qr_sessions (token_hash, account_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(hashValue(token), account.id, expires.toISOString(), now.toISOString()).run();
  return Response.json({ account }, {
    headers: { "Set-Cookie": `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000` },
  });
}

export async function DELETE(request: Request) {
  const token = request.headers.get("cookie")?.match(/(?:^|; )qr_session=([^;]+)/)?.[1];
  if (token) await db().prepare("DELETE FROM qr_sessions WHERE token_hash = ?").bind(hashValue(decodeURIComponent(token))).run();
  return Response.json({ success: true }, { headers: { "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` } });
}
