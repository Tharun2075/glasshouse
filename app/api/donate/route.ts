import { startDonation } from "@/lib/ledger.ts";
import { userFromRequest } from "@/lib/auth.ts";
import { json, origin } from "@/lib/http.ts";
import { toCents } from "@/lib/money.ts";
import { limit } from "@/lib/ratelimit.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const limited = await limit("donate", req); if (limited) return limited;
  const b = await req.json().catch(() => ({}));
  const u = userFromRequest(req);
  // Names are public on the ledger, so a donor is "Anonymous" unless they tick the opt-in box (N6).
  try {
    const o = await startDonation(Number(b.appeal_id), toCents(b.amount), { id: u?.id ?? null, name: u && b.show_name === true ? u.name : "Anonymous" }, origin(req));
    return json({ order_id: o.id, status: o.status, approve: o.approve }, 201);
  } catch (e) { return json({ error: (e as Error).message }, 400); }
}
