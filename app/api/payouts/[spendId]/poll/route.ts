import { pollPayout } from "@/lib/ledger.ts";
import { json, requireRole } from "@/lib/http.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: { params: Promise<{ spendId: string }> }) {
  const u = requireRole(req, "trustee"); if (u instanceof Response) return u;
  try { const p = await pollPayout(Number((await params).spendId)); return p ? json({ payout: p }) : json({ error: "no payout" }, 404); }
  catch (e) { return json({ error: (e as Error).message }, 502); }
}
