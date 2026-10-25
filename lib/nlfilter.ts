// Plain English -> AG Grid filter model. Claude when ANTHROPIC_API_KEY is set, else a small rule parser (labelled "rules").
import { z } from "zod";
import { MODEL } from "./extract.ts";

export const Intent = z.object({
  status: z.enum(["pending", "held", "approved", "paid", "rejected"]).nullable(),
  vendor: z.string().nullable(), category: z.string().nullable(), appeal: z.string().nullable(),
  min_amount: z.number().nullable(), max_amount: z.number().nullable(),
});
export type Intent = z.infer<typeof Intent>;
const nullable = (t: string) => ({ type: [t, "null"] });
const SCHEMA = { type: "object", additionalProperties: false, required: ["status", "vendor", "category", "appeal", "min_amount", "max_amount"],
  properties: { status: { type: ["string", "null"], enum: ["pending", "held", "approved", "paid", "rejected", null] }, vendor: nullable("string"), category: nullable("string"),
    appeal: nullable("string"), min_amount: nullable("number"), max_amount: nullable("number") } };

export function ruleIntent(q: string): Intent {
  const s = q.toLowerCase();
  const num = (re: RegExp) => { const m = s.match(re); return m ? Number(m[1].replace(/,/g, "")) : null; };
  const status = (["pending", "held", "approved", "paid", "rejected"] as const).find((k) => s.includes(k)) ?? (/(flag|anomal|suspicious)/.test(s) ? "held" : null);
  const cat = ["food", "supplies", "transport", "utilities", "fuel"].find((k) => s.includes(k)) ?? null;
  return { status, vendor: (s.match(/(?:from|at|vendor)\s+([a-z][a-z ]+?)(?:\s+(?:over|under|above|below|more|less)|$)/)?.[1] ?? null),
    category: cat === "fuel" ? "transport" : cat, appeal: null,
    min_amount: num(/(?:over|above|more than|>)\s*\$?([\d,.]+)/), max_amount: num(/(?:under|below|less than|<)\s*\$?([\d,.]+)/) };
}

export function toFilterModel(i: Intent) {
  const m: Record<string, unknown> = {};
  if (i.status) m.status = { filterType: "text", type: "equals", filter: i.status };
  if (i.vendor) m.vendor = { filterType: "text", type: "contains", filter: i.vendor };
  if (i.category) m.category = { filterType: "text", type: "contains", filter: i.category };
  if (i.appeal) m.appeal = { filterType: "text", type: "contains", filter: i.appeal };
  if (i.min_amount != null && i.max_amount != null) m.amount = { filterType: "number", type: "inRange", filter: i.min_amount, filterTo: i.max_amount };
  else if (i.min_amount != null) m.amount = { filterType: "number", type: "greaterThan", filter: i.min_amount };
  else if (i.max_amount != null) m.amount = { filterType: "number", type: "lessThan", filter: i.max_amount };
  return m;
}

export async function nlToFilter(q: string, client?: { messages: { create(b: any): Promise<any> } }) {
  if (!client && !process.env.ANTHROPIC_API_KEY) return { by: "rules", intent: ruleIntent(q), model: toFilterModel(ruleIntent(q)) };
  if (!client) { const { default: Anthropic } = await import("@anthropic-ai/sdk"); client = new Anthropic() as any; }
  const msg = await client!.messages.create({ model: MODEL, max_tokens: 512, output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: `Turn this question about a charity spending ledger into filters. Amounts are USD numbers. Question: ${q.slice(0, 300)}` }] });
  if (msg.stop_reason === "refusal") throw new Error("model refused");
  const intent = Intent.parse(JSON.parse(msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")));
  return { by: "claude", intent, model: toFilterModel(intent) };
}
