// Per-IP limit for anonymous endpoints that cost money or tokens (Claude NL filter, PayPal order create).
// rate-limiter-flexible (ISC) in-memory: fine for one Node process; use its Redis/SQLite store if this ever scales out.
import { RateLimiterMemory } from "rate-limiter-flexible";
import { json } from "./http.ts";

const limiters = new Map<string, RateLimiterMemory>();
/** Client IP. Behind a proxy, set TRUST_PROXY=1 so the first x-forwarded-for hop is used; otherwise it is spoofable. */
export const clientIp = (req: Request) =>
  (process.env.TRUST_PROXY === "1" && req.headers.get("x-forwarded-for")?.split(",")[0].trim()) || req.headers.get("x-real-ip") || "direct";

/** Returns a 429 Response when the caller is over `points` per `seconds`, else null. */
export async function limit(name: string, req: Request, points = 10, seconds = 60): Promise<Response | null> {
  let l = limiters.get(name);
  if (!l) limiters.set(name, (l = new RateLimiterMemory({ points, duration: seconds })));
  try { await l.consume(clientIp(req)); return null; }
  catch (r) {
    const wait = Math.ceil(((r as { msBeforeNext?: number }).msBeforeNext ?? 60_000) / 1000);
    const res = json({ error: `too many requests; try again in ${wait}s` }, 429);
    res.headers.set("retry-after", String(wait));
    return res;
  }
}
