import { ledger } from "@/lib/ledger.ts";
import { json } from "@/lib/http.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() { return json(ledger()); }
