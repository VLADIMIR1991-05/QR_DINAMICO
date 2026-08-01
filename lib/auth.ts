import { createHash, randomUUID } from "node:crypto";
import { db, ensureSchema } from "./qr-db";

export type Account = {
  id: string;
  name: string;
  email: string;
  role: "master" | "license";
  status: "active" | "suspended";
  max_qr: number;
  expires_at: string | null;
};

export const SESSION_COOKIE = "qr_session";

export function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") || "";
  for (const item of cookies.split(";")) {
    const [key, ...parts] = item.trim().split("=");
    if (key === name) return decodeURIComponent(parts.join("="));
  }
  return "";
}

export async function currentAccount(request: Request): Promise<Account | null> {
  await ensureSchema();
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const now = new Date().toISOString();
  const row = await db().prepare(`SELECT a.id, a.name, a.email, a.role, a.status, a.max_qr, a.expires_at
    FROM qr_sessions s JOIN qr_accounts a ON a.id = s.account_id
    WHERE s.token_hash = ? AND s.expires_at > ?`).bind(hashValue(token), now).first<Account>();
  if (!row || row.status !== "active" || (row.expires_at && row.expires_at <= now)) return null;
  return row;
}

export async function requireAccount(request: Request) {
  const account = await currentAccount(request);
  if (!account) return { account: null, response: Response.json({ error: "Inicia sesión con tu licencia" }, { status: 401 }) };
  return { account, response: null };
}

export async function requireMaster(request: Request) {
  const auth = await requireAccount(request);
  if (!auth.account || auth.account.role !== "master") {
    return { account: null, response: auth.response || Response.json({ error: "Acceso exclusivo de la cuenta maestra" }, { status: 403 }) };
  }
  return { account: auth.account, response: null };
}

export function newLicenseKey() {
  return `QR-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}
