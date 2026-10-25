import { nlToFilter } from "@/lib/nlfilter.ts";
import { json } from "@/lib/http.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  try { return json(await nlToFilter(String(b.q ?? ""))); } catch (e) { return json({ error: (e as Error).message }, 422); }
}
