import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { addSpend } from "@/lib/ledger.ts";
import { defaultExtractor, sha256 } from "@/lib/extract.ts";
import { DATA_DIR } from "@/lib/db.ts";
import { json, requireRole } from "@/lib/http.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const u = requireRole(req, "volunteer"); if (u instanceof Response) return u;
  const f = await req.formData();
  const file = f.get("receipt");
  if (!(file instanceof File) || file.type !== "image/png" || file.size > 5_000_000) return json({ error: "upload one PNG receipt under 5 MB" }, 400);
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const ext = await (await defaultExtractor()).extract(buf);
    const name = `up-${randomUUID()}.png`;
    mkdirSync(path.join(DATA_DIR, "receipts"), { recursive: true });
    writeFileSync(path.join(DATA_DIR, "receipts", name), buf);
    const s = addSpend(Number(f.get("appeal_id")), ext.data, ext.by, name, sha256(buf), u.id);
    return json({ spend: { ...s, receipt_hash: undefined }, extraction: ext.data, extracted_by: ext.by }, 201);
  } catch (e) { return json({ error: (e as Error).message }, 422); }
}
