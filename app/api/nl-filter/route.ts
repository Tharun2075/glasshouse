import { nlToFilter } from "@/lib/nlfilter.ts";
import { json } from "@/lib/http.ts";
import { limit } from "@/lib/ratelimit.ts";
export const MAX_Q = 200;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const limited = await limit("nl-filter", req); if (limited) return limited;
  const b = await req.json().catch(() => ({}));
  const q = String(b.q ?? "");
  if (q.length > MAX_Q) return json({ error: `question too long (max ${MAX_Q} characters)` }, 413);
  try { return json(await nlToFilter(q)); } catch (e) { return json({ error: (e as Error).message }, 422); }
}
