import { readFileSync } from "node:fs";
import path from "node:path";
import { one, DATA_DIR } from "@/lib/db.ts";
import { userFromRequest } from "@/lib/auth.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Approved and paid receipts are public proof; held and pending ones stay trustee-only until a trustee decides (N5).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = one<{ receipt_file: string; status: string }>("SELECT receipt_file, status FROM spends WHERE id=?", Number((await params).id));
  if (!s) return new Response("not found", { status: 404 });
  const pub = s.status === "approved" || s.status === "paid";
  if (!pub && userFromRequest(req)?.role !== "trustee") return new Response("This receipt is visible to trustees until it is approved.", { status: 403, headers: { "cache-control": "private, no-store" } });
  return new Response(readFileSync(path.join(DATA_DIR, "receipts", path.basename(s.receipt_file))), { headers: { "content-type": "image/png", "cache-control": pub ? "public, max-age=3600" : "private, no-store" } });
}
