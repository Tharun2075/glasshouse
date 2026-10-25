import { nlToFilter } from "@/lib/nlfilter.ts";
import { appeals } from "@/lib/ledger.ts";
import { json } from "@/lib/http.ts";
import { limit } from "@/lib/ratelimit.ts";
import { takeClaudeCall } from "@/lib/aiquota.ts";
import { userFromRequest } from "@/lib/auth.ts";
export const MAX_Q = 200;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const limited = await limit("nl-filter", req); if (limited) return limited;
  const b = await req.json().catch(() => ({}));
  const q = String(b.q ?? "");
  if (q.length > MAX_Q) return json({ error: `question too long (max ${MAX_Q} characters)` }, 413);
  const opts = { appeals: appeals().map((a) => a.title) };
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const quota = takeClaudeCall(req, userFromRequest(req)?.id);
      if (!quota.ok) return json({ ...(await nlToFilter(q, undefined, { ...opts, rulesOnly: true })), limit_note: quota.note });
    }
    return json(await nlToFilter(q, undefined, opts));
  } catch (e) { return json({ error: (e as Error).message }, 422); }
}
