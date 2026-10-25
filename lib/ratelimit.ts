// Per-IP limit for anonymous endpoints that cost money or tokens (Claude NL filter, PayPal order create).
// rate-limiter-flexible (ISC) in-memory: fine for one Node process; use its Redis/SQLite store if this ever scales out.
import { RateLimiterMemory } from "rate-limiter-flexible";
import { json } from "./http.ts";

const limiters = new Map<string, RateLimiterMemory>();
/** Client key. Next route handlers get no socket address, so headers are trusted only when TRUST_PROXY=1
 *  (our own proxy appends the real IP, so the RIGHTMOST x-forwarded-for hop is used; leftmost is client-spoofable).
 *  Without a trusted proxy every caller shares one "direct" bucket that gets a higher global cap (see limit()). */
export const clientIp = (req: Request): string | null => {
  if (process.env.TRUST_PROXY !== "1") return null;
  const hops = req.headers.get("x-forwarded-for")?.split(",").map((h) => h.trim()).filter(Boolean) ?? [];
  // TRUST_PROXY_HOPS = extra proxies of our own that append after the client hop (0 = the rightmost hop is the client)
  const skip = Math.max(0, Math.floor(Number(process.env.TRUST_PROXY_HOPS ?? 0)) || 0);
  return hops.at(-1 - skip) || req.headers.get("x-real-ip") || null;
};

/** Returns a 429 Response when the caller is over `points` per `seconds`, else null. */
export async function limit(name: string, req: Request, points = 10, seconds = 60): Promise<Response | null> {
  const ip = clientIp(req);
  // unidentified callers share one bucket, so it gets 6x the per-IP cap instead of letting one caller lock everyone out at 10
  const key = ip ? name : `${name}:global`, cap = ip ? points : points * 6;
  let l = limiters.get(key);
  if (!l) limiters.set(key, (l = new RateLimiterMemory({ points: cap, duration: seconds })));
  try { await l.consume(ip ?? "direct"); return null; }
  catch (r) {
    const wait = Math.ceil(((r as { msBeforeNext?: number }).msBeforeNext ?? 60_000) / 1000);
    const res = json({ error: `too many requests; try again in ${wait}s` }, 429);
    res.headers.set("retry-after", String(wait));
    return res;
  }
}
