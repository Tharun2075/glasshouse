// Plain English -> AG Grid filter model. Claude when ANTHROPIC_API_KEY is set, else a small rule parser (labelled "rules").
// Both read the same words: date ranges on the receipt date, status words (incl. "unpaid") on status, appeal names on appeal.
import { z } from "zod";
import { MODEL, anthropicOptions } from "./extract.ts";
import { CATEGORIES } from "./categories.ts";

export const STATUSES = ["pending", "held", "approved", "paid", "rejected"] as const;
// "Unpaid" is not one status: everything still waiting for money (rejected spends are never paid, so they are left out).
export const UNPAID = ["pending", "held", "approved"] as const;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const Intent = z.object({
  statuses: z.array(z.enum(STATUSES)),
  vendor: z.string().nullable(), category: z.string().nullable(), appeal: z.string().nullable(),
  min_amount: z.number().nullable(), max_amount: z.number().nullable(),
  date_from: z.string().regex(ISO).nullable(), date_to: z.string().regex(ISO).nullable(),
});
export type Intent = z.infer<typeof Intent>;
export type NlOpts = { today?: string; appeals?: string[]; rulesOnly?: boolean };
const nullable = (t: string) => ({ type: [t, "null"] });
// The API rejects an enum under a type array (live 400, 2026-10-25), so nullable enums use anyOf.
export const SCHEMA = { type: "object", additionalProperties: false,
  required: ["statuses", "vendor", "category", "appeal", "min_amount", "max_amount", "date_from", "date_to"],
  properties: { statuses: { type: "array", items: { type: "string", enum: [...STATUSES] } }, vendor: nullable("string"),
    category: { anyOf: [{ type: "string", enum: [...CATEGORIES] }, { type: "null" }] },
    appeal: nullable("string"), min_amount: nullable("number"), max_amount: nullable("number"),
    date_from: nullable("string"), date_to: nullable("string") } };

// ---- dates (built-in Date, UTC only, so the server's time zone never shifts a day) ----
const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MON = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DAY = "(\\d{1,2})(?:st|nd|rd|th)?";
const DATE = `(\\d{4}-\\d{2}-\\d{2}|${DAY}\\s+${MON}(?:\\s+(\\d{4}))?|${MON}\\s+${DAY}(?:,?\\s+(\\d{4}))?)`;

// One date phrase ("1 Oct", "October 1st 2026", "2026-10-01") -> YYYY-MM-DD. A date with no year is the most recent one not after today.
export function parseDate(t: string, today: string): string | null {
  t = t.trim().toLowerCase();
  if (ISO.test(t)) return t;
  const m = t.match(new RegExp(`^(?:${DAY}\\s+${MON}(?:\\s+(\\d{4}))?|${MON}\\s+${DAY}(?:,?\\s+(\\d{4}))?)$`));
  if (!m) return null;
  const day = Number(m[1] ?? m[5]), mon = MONTHS.indexOf((m[2] ?? m[4]).slice(0, 3)), yr = m[3] ?? m[6];
  const ty = Number(today.slice(0, 4));
  let d = utc(yr ? Number(yr) : ty, mon, day);
  if (!yr && iso(d) > today) d = utc(ty - 1, mon, day);
  return d.getUTCDate() === day ? iso(d) : null;
}

// Finds a date range in the question. Returns the matched words too, so the caller can strip them before reading vendor names.
export function dateRange(q: string, today: string): { from: string | null; to: string | null; words: string } | null {
  const s = q.toLowerCase(), t = new Date(`${today}T00:00:00Z`);
  const y = t.getUTCFullYear(), mo = t.getUTCMonth(), dow = (t.getUTCDay() + 6) % 7; // Monday = 0
  const add = (n: number) => iso(new Date(t.getTime() + n * 864e5));
  let m: RegExpMatchArray | null;
  if ((m = s.match(new RegExp(`\\b(?:between|from)\\s+${DATE}\\s+(?:and|to|until|till)\\s+${DATE}`)))) {
    const a = parseDate(m[1], today), b = parseDate(m[8], today);
    if (a && b) return { from: a, to: b, words: m[0] };
  }
  if ((m = s.match(new RegExp(`\\b(?:since|from|after)\\s+${DATE}`)))) { const a = parseDate(m[1], today); if (a) return { from: a, to: today, words: m[0] }; }
  if ((m = s.match(new RegExp(`\\b(?:before|until|till)\\s+${DATE}`)))) { const b = parseDate(m[1], today); if (b) return { from: null, to: iso(new Date(Date.parse(`${b}T00:00:00Z`) - 864e5)), words: m[0] }; } // "before X" ends the day before X
  if ((m = s.match(/\b(?:in the )?(?:last|past)\s+(\d{1,3})\s+days?\b/))) return { from: add(-Number(m[1])), to: today, words: m[0] };
  if ((m = s.match(/\blast month\b/))) return { from: iso(utc(y, mo - 1, 1)), to: iso(utc(y, mo, 0)), words: m[0] };
  if ((m = s.match(/\bthis month\b/))) return { from: iso(utc(y, mo, 1)), to: today, words: m[0] };
  if ((m = s.match(/\blast week\b/))) return { from: add(-dow - 7), to: add(-dow - 1), words: m[0] };
  if ((m = s.match(/\bthis week\b/))) return { from: add(-dow), to: today, words: m[0] };
  if ((m = s.match(/\byesterday\b/))) return { from: add(-1), to: add(-1), words: m[0] };
  if ((m = s.match(/\btoday\b/))) return { from: today, to: today, words: m[0] };
  if ((m = s.match(new RegExp(`\\b(?:in|during)\\s+${MON}(?:\\s+(\\d{4}))?\\b`)))) {
    const mon = MONTHS.indexOf(m[1].slice(0, 3)); let yr = m[2] ? Number(m[2]) : y;
    if (!m[2] && mon > mo) yr--;
    return { from: iso(utc(yr, mon, 1)), to: iso(utc(yr, mon + 1, 0)), words: m[0] };
  }
  return null;
}

// ---- status and appeal words ----
export function statusWords(q: string): (typeof STATUSES)[number][] {
  const s = q.toLowerCase();
  // "unpaid" / "not paid" / "outstanding" first: "unpaid" contains "paid" and must never mean paid.
  if (/\b(unpaid|not (?:yet )?paid|outstanding|awaiting payment)\b/.test(s)) return [...UNPAID];
  const out = new Set<(typeof STATUSES)[number]>();
  if (/\b(pending|waiting|to review|unreviewed)\b/.test(s)) out.add("pending");
  if (/\b(held|on hold|flagged|flags?|anomal\w*|suspicious)\b/.test(s)) out.add("held");
  if (/\b(approved)\b/.test(s)) out.add("approved");
  if (/\b(paid|paid out)\b/.test(s)) out.add("paid");
  if (/\b(rejected|refused|declined)\b/.test(s)) out.add("rejected");
  return STATUSES.filter((k) => out.has(k));
}

const STOP = new Set(["the", "a", "an", "of", "for", "and", "appeal", "fund"]);
const words = (t: string) => t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));
// An appeal is named when every meaningful word of its title is in the question ("kitchen equipment" -> "Kitchen Equipment").
export function matchAppeal(q: string, appeals: string[]): string | null {
  const have = new Set(words(q));
  const hits = appeals.filter((a) => words(a).length && words(a).every((w) => have.has(w)));
  return hits.sort((a, b) => words(b).length - words(a).length)[0] ?? null;
}
const stripWords = (s: string, title: string) => words(title).reduce((t, w) => t.replace(new RegExp(`\\b${w}\\b`, "g"), " "), s);

export function ruleIntent(q: string, opts: NlOpts = {}): Intent {
  const today = opts.today ?? iso(new Date());
  let s = q.toLowerCase();
  const range = dateRange(s, today);
  if (range) s = s.replace(range.words, " ");
  const appeal = matchAppeal(s, opts.appeals ?? []);
  // Words that named the appeal are not read again as a category ("kitchen equipment" is the appeal, not category "equipment").
  const rest = appeal ? stripWords(s, appeal) : s;
  const num = (re: RegExp) => { const m = rest.match(re); return m ? Number(m[1].replace(/,/g, "")) : null; };
  const vendor = rest.match(/\b(?:from|at|vendor)\s+([a-z][a-z' &]+?)(?:\s+(?:over|under|above|below|more|less|that|which|with|in|for|since|before|after|last|this)\b|\s*$)/)?.[1]?.trim() ?? null;
  return { statuses: statusWords(rest), vendor,
    category: CATEGORIES.find((k) => new RegExp(`\\b${k}\\b`).test(rest)) ?? null, appeal,
    min_amount: num(/(?:over|above|more than|>)\s*\$?([\d,.]+)/), max_amount: num(/(?:under|below|less than|<)\s*\$?([\d,.]+)/),
    date_from: range?.from ?? null, date_to: range?.to ?? null };
}

export function toFilterModel(i: Intent) {
  const m: Record<string, unknown> = {};
  const eq = (v: string) => ({ filterType: "text", type: "equals", filter: v });
  if (i.statuses.length === 1) m.status = eq(i.statuses[0]);
  else if (i.statuses.length > 1) m.status = { filterType: "text", operator: "OR", conditions: i.statuses.map(eq) };
  if (i.vendor) m.vendor = { filterType: "text", type: "contains", filter: i.vendor };
  if (i.category) m.category = { filterType: "text", type: "equals", filter: i.category };
  if (i.appeal) m.appeal = { filterType: "text", type: "contains", filter: i.appeal };
  if (i.min_amount != null && i.max_amount != null) m.amount = { filterType: "number", type: "inRange", filter: i.min_amount, filterTo: i.max_amount };
  else if (i.min_amount != null) m.amount = { filterType: "number", type: "greaterThan", filter: i.min_amount };
  else if (i.max_amount != null) m.amount = { filterType: "number", type: "lessThan", filter: i.max_amount };
  // The grid's date filter is inclusive (inRangeInclusive), so both ends count.
  if (i.date_from || i.date_to) m.date = { filterType: "date", type: "inRange", dateFrom: i.date_from ?? "1970-01-01", dateTo: i.date_to ?? "9999-12-31" };
  return m;
}

export function filterPrompt(q: string, today: string, appeals: string[]) {
  return [
    "Turn this question about a charity spending ledger into filters. Amounts are USD numbers.",
    `Today is ${today}. Dates are YYYY-MM-DD and filter the receipt date; both ends are included.`,
    "last month = first to last day of the previous calendar month; this month = 1st of this month to today; this week = Monday to today;",
    "last week = Monday to Sunday of the previous week; since/from/after X = X to today; last N days = today minus N days to today. No date words = both null.",
    `statuses: pending, held (flagged, on hold), approved, paid, rejected. "unpaid"/"not paid"/"outstanding" = [${UNPAID.join(", ")}]. No status words = [].`,
    `appeal = one of these fundraising appeals, copied exactly: ${appeals.length ? appeals.map((a) => `"${a}"`).join(", ") : "(none)"}.`,
    `An appeal name is not a category: when the words name an appeal, set appeal and leave category null. category is one of ${CATEGORIES.join(", ")}.`,
    "vendor = the shop or supplier name only.",
    `Question: ${q.slice(0, 300)}`,
  ].join("\n");
}

type Client = { messages: { create(b: any): Promise<any> } };
export async function nlToFilter(q: string, client?: Client, opts: NlOpts = {}) {
  const today = opts.today ?? iso(new Date()), appeals = opts.appeals ?? [];
  if (opts.rulesOnly || (!client && !process.env.ANTHROPIC_API_KEY)) { const intent = ruleIntent(q, { today, appeals }); return { by: "rules", intent, model: toFilterModel(intent) }; }
  if (!client) { const { default: Anthropic } = await import("@anthropic-ai/sdk"); client = new Anthropic(anthropicOptions()) as any; }
  const msg = await client!.messages.create({ model: MODEL, max_tokens: 512, output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: filterPrompt(q, today, appeals) }] });
  if (msg.stop_reason === "refusal") throw new Error("model refused");
  const intent = Intent.parse(JSON.parse(msg.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")));
  // Snap Claude's appeal to a real title (case, spacing); an unknown name stays as typed so the filter is visible, not silently dropped.
  if (intent.appeal) intent.appeal = appeals.find((a) => a.toLowerCase() === intent.appeal!.toLowerCase()) ?? matchAppeal(intent.appeal, appeals) ?? intent.appeal;
  if (intent.date_from && !intent.date_to) intent.date_to = today;
  return { by: "claude", intent, model: toFilterModel(intent) };
}
