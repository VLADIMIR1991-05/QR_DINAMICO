export type DbEnv = { DB: D1Database };

declare global {
  var __QR_DYNAMIC_ENV__: DbEnv | undefined;
}

export function db() {
  const database = globalThis.__QR_DYNAMIC_ENV__?.DB;
  if (!database) throw new Error("La base de datos no está disponible en este momento.");
  return database;
}

export async function ensureSchema() {
  const database = db();
  await database.prepare(`CREATE TABLE IF NOT EXISTS qr_accounts (
    id TEXT PRIMARY KEY,
    license_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'license',
    status TEXT NOT NULL DEFAULT 'active',
    max_qr INTEGER NOT NULL DEFAULT 25,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await database.prepare(`CREATE TABLE IF NOT EXISTS qr_sessions (
    token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`).run();
  await database.prepare(`CREATE TABLE IF NOT EXISTS qr_codes (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    destination TEXT NOT NULL,
    edit_token TEXT NOT NULL,
    scans INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    account_id TEXT
  )`).run();
  try {
    await database.prepare("ALTER TABLE qr_codes ADD COLUMN account_id TEXT").run();
  } catch {
    // La columna ya existe.
  }
  const now = new Date().toISOString();
  await database.prepare(`INSERT OR IGNORE INTO qr_accounts
    (id, license_hash, name, email, role, status, max_qr, expires_at, created_at, updated_at)
    VALUES ('master', 'accf4412e3ee17ab2e7700e9ac2ee3442f7566fd85ae55a3aba2d052fb7afc72',
    'Cuenta maestra', 'lenin19910527@gmail.com', 'master', 'active', 100000, NULL, ?, ?)`)
    .bind(now, now).run();
  await database.prepare("UPDATE qr_codes SET account_id = 'master' WHERE account_id IS NULL OR account_id = ''").run();
  await database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS qr_codes_slug_idx ON qr_codes(slug)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS qr_codes_account_idx ON qr_codes(account_id)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS qr_sessions_account_idx ON qr_sessions(account_id)").run();
}

export function isSafeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
