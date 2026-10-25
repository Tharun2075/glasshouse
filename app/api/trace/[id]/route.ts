import { trace } from "@/lib/ledger.ts";
import { json } from "@/lib/http.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = trace(Number((await params).id));
  return t ? json(t) : json({ error: "not found" }, 404);
}
