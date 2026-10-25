import { approveSpend } from "@/lib/ledger.ts";
import { json, requireRole } from "@/lib/http.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const u = requireRole(req, "trustee"); if (u instanceof Response) return u;
  const r = await approveSpend(Number((await params).id), u.id);
  return json(r.body, r.status);
}
