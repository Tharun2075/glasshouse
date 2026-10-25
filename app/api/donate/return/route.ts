import { captureDonation } from "@/lib/ledger.ts";
import { origin } from "@/lib/http.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// PayPal sends the buyer back here with ?token=<order id>; capture server-side, then show the trace.
export async function GET(req: Request) {
  const o = origin(req), token = new URL(req.url).searchParams.get("token") ?? "";
  try {
    const r = await captureDonation(token);
    const d = (r.body as any).donation;
    return Response.redirect(d ? `${o}/trace/${d.id}?new=1` : `${o}/donate?error=${encodeURIComponent(String((r.body as any).error))}`, 303);
  } catch (e) { return Response.redirect(`${o}/donate?error=${encodeURIComponent((e as Error).message)}`, 303); }
}
