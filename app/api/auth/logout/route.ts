import { COOKIE, cookieAttrs } from "@/lib/auth.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  return new Response(null, { status: 303, headers: { location: new URL("/ledger", req.url).toString(), "set-cookie": `${COOKIE}=; ${cookieAttrs()}; Max-Age=0` } });
}
