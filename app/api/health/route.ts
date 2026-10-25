// Render health check: no DB, no network, always fast. ?ip=1 also shows the caller which client key the limits use (their own IP only).
import { clientIp } from "@/lib/ratelimit.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(req: Request) {
  const body: Record<string, unknown> = { ok: true };
  if (new URL(req.url).searchParams.get("ip") === "1") body.client_key = clientIp(req) ?? "none (TRUST_PROXY off)";
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}
