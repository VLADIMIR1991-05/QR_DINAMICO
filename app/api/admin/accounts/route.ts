import { randomUUID } from "node:crypto";
import { hashValue, newLicenseKey, requireMaster } from "../../../../lib/auth";
import { db } from "../../../../lib/qr-db";

export async function GET(request: Request) {
  const auth = await requireMaster(request);
  if (auth.response) return auth.response;
  const accounts = await db().prepare(`SELECT a.id, a.name, a.email, a.role, a.status, a.max_qr, a.expires_at, a.created_at,
    COUNT(q.id) AS qr_count, COALESCE(SUM(q.scans), 0) AS total_scans
    FROM qr_accounts a LEFT JOIN qr_codes q ON q.account_id = a.id
    GROUP BY a.id ORDER BY a.role = 'master' DESC, a.created_at DESC`).all();
  const codes = await db().prepare(`SELECT q.id, q.slug, q.name, q.destination, q.scans, q.created_at,
    q.account_id, a.name AS owner_name FROM qr_codes q LEFT JOIN qr_accounts a ON a.id = q.account_id
    ORDER BY q.created_at DESC`).all();
  return Response.json({ accounts: accounts.results, codes: codes.results });
}

export async function POST(request: Request) {
  const auth = await requireMaster(request);
  if (auth.response) return auth.response;
  const body = await request.json() as { name?: string; email?: string; maxQr?: number; expiresAt?: string | null };
  const name = body.name?.trim() || "Nueva licencia";
  const key = newLicenseKey();
  const id = randomUUID();
  const now = new Date().toISOString();
  const maxQr = Math.max(1, Math.min(10000, Number(body.maxQr) || 25));
  await db().prepare(`INSERT INTO qr_accounts
    (id, license_hash, name, email, role, status, max_qr, expires_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'license', 'active', ?, ?, ?, ?)`)
    .bind(id, hashValue(key), name.slice(0, 80), (body.email || "").trim().slice(0, 120), maxQr, body.expiresAt || null, now, now).run();
  return Response.json({ id, key, name, maxQr }, { status: 201 });
}
