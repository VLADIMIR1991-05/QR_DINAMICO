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
  await database.prepare(`CREATE TABLE IF NOT EXISTS qr_codes (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    destination TEXT NOT NULL,
    edit_token TEXT NOT NULL,
    scans INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS qr_codes_slug_idx ON qr_codes(slug)").run();
}

export function isSafeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
