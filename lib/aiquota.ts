// Claude cost guard for a public demo. Each visitor gets their own daily allowance, so one visitor can never use up
// the AI for everyone: anonymous callers are keyed by client IP (CLAUDE_PER_IP_DAILY), signed-in demo/judge accounts by
// account + IP (CLAUDE_PER_ACCOUNT_DAILY; a judge behind a busy shared IP is not starved, and one person on a shared demo
// login cannot drain it for others). A high overall backstop (CLAUDE_DAILY_CAP) stops address-hopping. Over any limit that
// caller alone falls back to the demo reader / rules with LIMIT_NOTE. Counts are per UTC day in SQLite.
import { db } from "./db.ts";
import { clientIp } from "./ratelimit.ts";

export const LIMIT_NOTE = "AI limit reached for today, demo reader used";
const num = (v: string | undefined, d: number) => { const n = Number(v); return v !== undefined && v !== "" && Number.isFinite(n) && n >= 0 ? Math.floor(n) : d; };
export const limits = (env: Record<string, string | undefined> = process.env) => ({
  perIp: num(env.CLAUDE_PER_IP_DAILY, 15), perAccount: num(env.CLAUDE_PER_ACCOUNT_DAILY, 40), total: num(env.CLAUDE_DAILY_CAP, 1000),
});
export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

const ensure = () => db().exec("CREATE TABLE IF NOT EXISTS ai_usage(day TEXT NOT NULL, bucket TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY(day, bucket))");
const count = (day: string, bucket: string) => (db().prepare("SELECT n FROM ai_usage WHERE day=? AND bucket=?").get(day, bucket) as { n: number } | undefined)?.n ?? 0;
const bump = (day: string, bucket: string) => db().prepare("INSERT INTO ai_usage(day,bucket,n) VALUES(?,?,1) ON CONFLICT(day,bucket) DO UPDATE SET n=n+1").run(day, bucket);

export type Quota = { ok: true } | { ok: false; reason: "visitor" | "account" | "total"; note: string };
/** Reserves one Claude call for this caller, or says which limit is hit. Check + increment in one transaction. */
export function takeClaudeCall(req: Request, userId?: number | null, now = new Date()): Quota {
  ensure();
  const day = utcDay(now), L = limits(), ip = clientIp(req);
  // No trusted client IP (local `next start` without TRUST_PROXY): do not merge everyone into one small bucket; only the backstop applies
  const [bucket, cap, reason] = !ip ? [null, 0, "visitor" as const] : userId ? [`acct:${userId}@${ip}`, L.perAccount, "account" as const] : [`ip:${ip}`, L.perIp, "visitor" as const];
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    if (count(day, "total") >= L.total) { d.exec("COMMIT"); return { ok: false, reason: "total", note: LIMIT_NOTE }; }
    if (bucket && count(day, bucket) >= cap) { d.exec("COMMIT"); return { ok: false, reason, note: LIMIT_NOTE }; }
    bump(day, "total"); if (bucket) bump(day, bucket);
    d.exec("COMMIT");
    return { ok: true };
  } catch (e) { d.exec("ROLLBACK"); throw e; }
}
