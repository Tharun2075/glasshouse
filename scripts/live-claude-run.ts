// One-off LIVE Claude run (needs ANTHROPIC_API_KEY, and ANTHROPIC_WORKSPACE_ID for org-wide keys).
// Reads 5 fixture receipts through the app's own ClaudeExtractor + addSpend, and 3 questions through nlToFilter,
// then writes raw results next to the expected values in docs/claude-runs/. The key is never printed or saved.
// Run: node --experimental-strip-types scripts/live-claude-run.ts   (LIVE_ONLY=extract-5,filter-1 reruns just those)
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY not set; this script only does live runs"); process.exit(2); }
const ROOT = process.cwd();
const tmp = mkdtempSync(path.join(tmpdir(), "gh-live-"));
process.env.GH_DATA_DIR = tmp; process.env.GH_DB = path.join(tmp, "live.db");
const { default: Anthropic } = await import("@anthropic-ai/sdk");
const { ClaudeExtractor, MODEL, sha256, anthropicOptions } = await import("../lib/extract.ts");
const { nlToFilter } = await import("../lib/nlfilter.ts");
const { run } = await import("../lib/db.ts");
const { addSpend } = await import("../lib/ledger.ts");

const MAX_CALLS = 10;
const only = (id: string) => !process.env.LIVE_ONLY || process.env.LIVE_ONLY.split(",").includes(id);
let calls = 0;
const real = new Anthropic(anthropicOptions());
let last: { request_id: string | null; raw: unknown } = { request_id: null, raw: null };
// Same client shape the app uses; only adds request_id capture and a hard call cap.
const client = { messages: { async create(body: any) {
  if (++calls > MAX_CALLS) throw new Error("call cap reached");
  const { data, request_id } = await real.messages.create(body).withResponse();
  last = { request_id: request_id ?? null, raw: data }; return data;
} } };

run("INSERT INTO orgs(id,name) VALUES(1,'Northside Food Bank')");
run("INSERT INTO appeals(id,org_id,title,goal_cents,item_cap_cents) VALUES(1,1,'Winter Food Parcels',300000,50000),(2,1,'Kitchen Equipment',150000,40000),(3,1,'Delivery Van Fuel',60000,15000)");

const out = path.join(ROOT, "docs", "claude-runs"); mkdirSync(out, { recursive: true });
const manifest = JSON.parse(readFileSync(path.join(ROOT, "data/fixtures/manifest.json"), "utf8"));
const RECEIPTS: [string, number][] = [["data/receipts/r1.png", 1], ["data/receipts/r4.png", 2], ["data/receipts/r5.png", 3], ["data/fixtures/upload-sample.png", 1], ["data/fixtures/unreadable.png", 1]];
const extractor = new ClaudeExtractor(client);
let n = 0;
for (const [file, appeal] of RECEIPTS) {
  n++; if (!only(`extract-${n}`)) continue; last = { request_id: null, raw: null };
  const png = readFileSync(path.join(ROOT, file)); const hash = sha256(png);
  const expected = manifest[hash] ?? { note: "not in manifest: deliberately unreadable fixture; expected outcome = HELD, never payable" };
  const rec: any = { n, file, appeal_id: appeal, model: MODEL, at_utc: new Date().toISOString(), expected };
  try {
    const r = await extractor.extract(png);
    const s = addSpend(appeal, r.data, r.by, path.basename(file), hash, null);
    Object.assign(rec, { by: r.by, extracted: r.data, ledger: { status: s.status, hold_reason: s.hold_reason, flags: JSON.parse(s.flags) } });
  } catch (e: any) {
    // The upload route answers an extraction error with an error and saves no spend: nothing exists that could be paid.
    Object.assign(rec, { error: String(e?.message ?? e).slice(0, 300), ledger: { status: "not saved (extraction error)" } });
  }
  rec.request_id = last.request_id;
  rec.raw_response = last.raw;
  writeFileSync(path.join(out, `extract-${n}.json`), JSON.stringify(rec, null, 1) + "\n");
  console.log(`extract-${n}`, file, rec.ledger?.status, rec.error ?? "");
}

const QUESTIONS: [string, Record<string, unknown>][] = [
  ["food over 20 dollars last month", { category: "food", min_amount: 20, note: "intent has no date field, so 'last month' cannot be expressed" }],
  ["unpaid receipts from Fresh Mart", { vendor: "Fresh Mart", status: "pending or held (unpaid is not one status)" }],
  ["held spends for kitchen equipment under $400", { status: "held", appeal: "kitchen equipment", max_amount: 400 }],
];
n = 0;
for (const [q, expected] of QUESTIONS) {
  n++; if (!only(`filter-${n}`)) continue; last = { request_id: null, raw: null };
  const rec: any = { n, question: q, model: MODEL, at_utc: new Date().toISOString(), expected };
  try { const r = await nlToFilter(q, client); Object.assign(rec, { by: r.by, intent: r.intent, ag_grid_filter_model: r.model }); }
  catch (e: any) { rec.error = String(e?.message ?? e).slice(0, 300); }
  rec.request_id = last.request_id; rec.raw_response = last.raw;
  writeFileSync(path.join(out, `filter-${n}.json`), JSON.stringify(rec, null, 1) + "\n");
  console.log(`filter-${n}`, q, JSON.stringify(rec.intent ?? rec.error));
}
console.log("API calls used:", calls);
