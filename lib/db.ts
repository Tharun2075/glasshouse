import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

export const DATA_DIR = process.env.GH_DATA_DIR ?? path.join(process.cwd(), "data");
const g = globalThis as unknown as { __ghdb?: DatabaseSync };

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS orgs(id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('donor','volunteer','trustee')), pw TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS appeals(id INTEGER PRIMARY KEY, org_id INTEGER NOT NULL, title TEXT NOT NULL, goal_cents INTEGER NOT NULL, item_cap_cents INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS donations(id INTEGER PRIMARY KEY, appeal_id INTEGER NOT NULL, donor_id INTEGER, donor_name TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'USD',
  order_id TEXT UNIQUE NOT NULL, capture_id TEXT, status TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'paypal-sandbox', created_at TEXT NOT NULL, captured_at TEXT, captured_value TEXT);
CREATE TABLE IF NOT EXISTS spends(id INTEGER PRIMARY KEY, appeal_id INTEGER NOT NULL, vendor TEXT NOT NULL, date TEXT NOT NULL, amount_cents INTEGER NOT NULL, currency TEXT NOT NULL,
  category TEXT NOT NULL, line_items TEXT NOT NULL, confidence REAL NOT NULL, extracted_by TEXT NOT NULL, receipt_file TEXT NOT NULL, receipt_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','held','approved','paid','rejected')), hold_reason TEXT, flags TEXT NOT NULL DEFAULT '[]', created_by INTEGER, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS approvals(id INTEGER PRIMARY KEY, spend_id INTEGER NOT NULL UNIQUE, trustee_id INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payouts(id INTEGER PRIMARY KEY, spend_id INTEGER NOT NULL UNIQUE, sender_batch_id TEXT NOT NULL UNIQUE, batch_id TEXT, status TEXT NOT NULL, item_status TEXT,
  http INTEGER, debug_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
`;

export function db(): DatabaseSync {
  if (!g.__ghdb) {
    mkdirSync(DATA_DIR, { recursive: true });
    const d = new DatabaseSync(process.env.GH_DB ?? path.join(DATA_DIR, "glasshouse.db"));
    d.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
    d.exec(SCHEMA);
    g.__ghdb = d;
  }
  return g.__ghdb;
}

export const now = () => new Date().toISOString();
// node:sqlite rows have a null prototype, which React refuses to pass to client components: copy to plain objects.
export const all = <T>(sql: string, ...p: any[]) => db().prepare(sql).all(...p).map((r) => ({ ...r })) as T[];
export const one = <T>(sql: string, ...p: any[]) => { const r = db().prepare(sql).get(...p); return (r ? { ...r } : undefined) as T | undefined; };
export const run = (sql: string, ...p: any[]) => db().prepare(sql).run(...p);
