import { captureDonation } from "@/lib/ledger.ts";
import { json } from "@/lib/http.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  try { const r = await captureDonation(String(b.order_id ?? "")); return json(r.body, r.status); }
  catch (e) { return json({ error: (e as Error).message }, 502); }
}
