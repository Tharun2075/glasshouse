import { captureDonation } from "@/lib/ledger.ts";
import { json } from "@/lib/http.ts";
import { limit } from "@/lib/ratelimit.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const limited = await limit("capture", req); if (limited) return limited;
  const b = await req.json().catch(() => ({}));
  try { const r = await captureDonation(String(b.order_id ?? "")); return json(r.body, r.status); }
  catch (e) { return json({ error: (e as Error).message }, 502); }
}
