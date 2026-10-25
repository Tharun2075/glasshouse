import { readFileSync } from "node:fs";
import path from "node:path";
import { one, DATA_DIR } from "@/lib/db.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = one<{ receipt_file: string }>("SELECT receipt_file FROM spends WHERE id=?", Number((await params).id));
  if (!s) return new Response("not found", { status: 404 });
  return new Response(readFileSync(path.join(DATA_DIR, "receipts", path.basename(s.receipt_file))), { headers: { "content-type": "image/png", "cache-control": "public, max-age=3600" } });
}
