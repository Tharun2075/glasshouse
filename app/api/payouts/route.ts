import { requestPayout } from "@/lib/ledger.ts";
import { json, requireRole } from "@/lib/http.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Gate: no trustee approval -> 403 and no PayPal batch is created.
export async function POST(req: Request) {
  const u = requireRole(req, "trustee"); if (u instanceof Response) return u;
  const b = await req.json().catch(() => ({}));
  const r = await requestPayout(Number(b.spend_id));
  return json(r.body, r.status);
}
