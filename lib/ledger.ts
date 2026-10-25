// Domain services shared by API routes, seed and tests. Every money move goes through here.
import { randomUUID } from "node:crypto";
import { all, one, run, now, db } from "./db.ts";
import { checkAnomaly } from "./anomaly.ts";
import { payoutGate } from "./gate.ts";
import { traceDonation, allocateFifo, type Don, type Sp } from "./allocation.ts";
import { toCents, fmt } from "./money.ts";
import type { Extraction } from "./extract.ts";
import * as pp from "./paypal.ts";

export type Appeal = { id: number; title: string; goal_cents: number; item_cap_cents: number };
export type Spend = { id: number; appeal_id: number; vendor: string; date: string; amount_cents: number; currency: string; category: string; line_items: string;
  confidence: number; extracted_by: string; receipt_file: string; receipt_hash: string; status: string; hold_reason: string | null; flags: string; created_at: string };
export type Donation = { id: number; appeal_id: number; donor_id: number | null; donor_name: string; amount_cents: number; order_id: string; capture_id: string | null; status: string; source: string; created_at: string };
export type Payout = { id: number; spend_id: number; sender_batch_id: string; batch_id: string | null; status: string; item_status: string | null; http: number | null; created_at: string; updated_at: string };

export const appeals = () => all<Appeal>("SELECT id,title,goal_cents,item_cap_cents FROM appeals ORDER BY id");
export const spends = () => all<Spend>("SELECT * FROM spends ORDER BY created_at, id");
export const donations = (completedOnly = true) => all<Donation>(`SELECT * FROM donations ${completedOnly ? "WHERE status='COMPLETED'" : ""} ORDER BY created_at, id`);
export const payouts = () => all<Payout>("SELECT * FROM payouts ORDER BY id");

/** Spends that count as real outgoings for FIFO: approved or paid only. */
const fundedSpends = (): Sp[] => all<Sp>("SELECT id,appeal_id,amount_cents,created_at FROM spends WHERE status IN ('approved','paid') ORDER BY created_at,id");

// ---------- receipts -> spends (never paid here) ----------
export function addSpend(appealId: number, ext: Extraction, by: string, file: string, hash: string, userId: number | null, createdAt = now()) {
  const appeal = one<Appeal>("SELECT * FROM appeals WHERE id=?", appealId);
  if (!appeal) throw new Error("unknown appeal");
  const cents = toCents(ext.amount);
  const flags: string[] = [];
  const reasons: string[] = [];
  const sameHash = one<{ id: number }>("SELECT id FROM spends WHERE receipt_hash=?", hash);
  const sameFacts = one<{ id: number }>("SELECT id FROM spends WHERE lower(vendor)=lower(?) AND date=? AND amount_cents=?", ext.vendor, ext.date, cents);
  if (sameHash || sameFacts) { flags.push("duplicate"); reasons.push(`Held: looks like a duplicate of spend #${(sameHash ?? sameFacts)!.id}`); }
  if (cents > appeal.item_cap_cents) { flags.push("over_cap"); reasons.push(`Held: $${fmt(cents)} is over the $${fmt(appeal.item_cap_cents)} per-item cap for this appeal`); }
  const prior = all<{ amount_cents: number }>("SELECT amount_cents FROM spends WHERE appeal_id=? AND status IN ('approved','paid','pending') ORDER BY created_at,id", appealId).map((r) => r.amount_cents);
  const a = checkAnomaly(cents, prior);
  if (a.held) { flags.push("anomaly"); reasons.push(a.reason!); }
  if (ext.confidence < 0.5) flags.push("low_confidence");
  const status = reasons.length ? "held" : "pending"; // NOTHING is auto-paid: best case is 'pending' trustee review
  const r = run(`INSERT INTO spends(appeal_id,vendor,date,amount_cents,currency,category,line_items,confidence,extracted_by,receipt_file,receipt_hash,status,hold_reason,flags,created_by,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, appealId, ext.vendor, ext.date, cents, ext.currency, ext.category, JSON.stringify(ext.line_items), ext.confidence, by, file, hash, status, reasons.join(" · ") || null, JSON.stringify(flags), userId, createdAt);
  return one<Spend>("SELECT * FROM spends WHERE id=?", Number(r.lastInsertRowid))!;
}

// ---------- trustee approval -> exactly one payout ----------
export type PayoutResult = { status: number; body: Record<string, unknown> };

export async function requestPayout(spendId: number, receiver = process.env.PAYPAL_PAYOUT_RECEIVER ?? "", createPayout = pp.createPayout): Promise<PayoutResult> {
  const spend = one<Spend>("SELECT * FROM spends WHERE id=?", spendId);
  const approvals = one<{ n: number }>("SELECT count(*) n FROM approvals WHERE spend_id=?", spendId)!.n;
  const gate = payoutGate(spend, approvals);
  if (!gate.ok) return { status: gate.status, body: { error: gate.error } };
  const existing = one<Payout>("SELECT * FROM payouts WHERE spend_id=?", spendId);
  if (existing) return { status: 200, body: { payout: existing, replay: true } };
  // PayPal rejects a reused sender_batch_id for 30 days, so it gets a random part (a reseeded demo DB
  // restarts spend ids at 1). Idempotency comes from the UNIQUE payouts.spend_id row, not from this id.
  const sbid = `gh-spend-${spendId}-${randomUUID().slice(0, 8)}`;
  const t = now();
  try { run("INSERT INTO payouts(spend_id,sender_batch_id,status,created_at,updated_at) VALUES(?,?,?,?,?)", spendId, sbid, "CREATING", t, t); }
  catch { return { status: 200, body: { payout: one<Payout>("SELECT * FROM payouts WHERE spend_id=?", spendId), replay: true } }; }
  try {
    const res = await createPayout(sbid, receiver, spend!.amount_cents, `Glasshouse spend #${spendId}: ${spend!.vendor}`);
    run("UPDATE payouts SET batch_id=?, status=?, updated_at=? WHERE spend_id=?", res.batchId, res.status, now(), spendId);
  } catch (e) {
    run("UPDATE payouts SET status=?, updated_at=? WHERE spend_id=?", "ERROR: " + String((e as Error).message).slice(0, 200), now(), spendId);
  }
  return { status: 201, body: { payout: one<Payout>("SELECT * FROM payouts WHERE spend_id=?", spendId) } };
}

export async function approveSpend(spendId: number, trusteeId: number, createPayout = pp.createPayout): Promise<PayoutResult> {
  const spend = one<Spend>("SELECT * FROM spends WHERE id=?", spendId);
  if (!spend) return { status: 404, body: { error: "unknown spend" } };
  if (spend.status === "held") return { status: 403, body: { error: "held spends cannot be approved: " + spend.hold_reason } };
  if (spend.status === "pending") {
    db().exec("BEGIN IMMEDIATE");
    try {
      run("INSERT OR IGNORE INTO approvals(spend_id,trustee_id,created_at) VALUES(?,?,?)", spendId, trusteeId, now());
      run("UPDATE spends SET status='approved' WHERE id=? AND status='pending'", spendId);
      db().exec("COMMIT");
    } catch (e) { db().exec("ROLLBACK"); throw e; }
  }
  return requestPayout(spendId, undefined, createPayout);
}

export async function pollPayout(spendId: number, getPayout = pp.getPayout) {
  const p = one<Payout>("SELECT * FROM payouts WHERE spend_id=?", spendId);
  if (!p?.batch_id) return p ?? null;
  const s = await getPayout(p.batch_id);
  run("UPDATE payouts SET status=?, item_status=?, updated_at=? WHERE spend_id=?", s.status, s.itemStatus ?? null, now(), spendId);
  if (s.status === "SUCCESS") run("UPDATE spends SET status='paid' WHERE id=? AND status='approved'", spendId);
  return one<Payout>("SELECT * FROM payouts WHERE spend_id=?", spendId)!;
}

// ---------- donations ----------
export async function startDonation(appealId: number, cents: number, donor: { id: number | null; name: string }, origin: string) {
  const appeal = one<Appeal>("SELECT * FROM appeals WHERE id=?", appealId);
  if (!appeal) throw new Error("unknown appeal");
  if (!Number.isInteger(cents) || cents < 100 || cents > 1_000_000) throw new Error("amount must be between $1 and $10,000");
  const o = await pp.createOrder(cents, appeal.title, `${origin}/api/donate/return`, `${origin}/donate?cancelled=1`, `ord-${randomUUID()}`);
  run("INSERT INTO donations(appeal_id,donor_id,donor_name,amount_cents,order_id,status,created_at) VALUES(?,?,?,?,?,?,?)", appealId, donor.id, donor.name, cents, o.id, "CREATED", now());
  return o;
}

/** Idempotent: a replayed capture returns the same row and never double-counts. */
export async function captureDonation(orderId: string, capture = pp.captureOrder) {
  const d = one<Donation>("SELECT * FROM donations WHERE order_id=?", orderId);
  if (!d) return { status: 404, body: { error: "unknown order" } };
  if (d.status === "COMPLETED") return { status: 200, body: { donation: d, replay: true } };
  const c = await capture(orderId, `cap-${orderId}`);
  if (c.status !== "COMPLETED") return { status: 502, body: { error: `capture status ${c.status}` } };
  const got = c.captured;
  if (!got || got.currency_code !== "USD" || toCents(got.value) !== d.amount_cents)
    return { status: 409, body: { error: `captured ${got?.value} ${got?.currency_code} does not match item total ${fmt(d.amount_cents)} USD` } };
  run("UPDATE donations SET status='COMPLETED', capture_id=?, captured_at=? WHERE order_id=? AND status<>'COMPLETED'", c.captureId, now(), orderId);
  return { status: 201, body: { donation: one<Donation>("SELECT * FROM donations WHERE order_id=?", orderId) } };
}

// ---------- trace + ledger ----------
export function trace(donationId: number) {
  const d = one<Donation>("SELECT * FROM donations WHERE id=? AND status='COMPLETED'", donationId);
  if (!d) return null;
  const sp = spends();
  const rows = traceDonation(d, donations() as Don[], fundedSpends()).map((r) => {
    const s = r.spend_id ? sp.find((x) => x.id === r.spend_id) : undefined;
    return { ...r, vendor: s?.vendor ?? null, date: s?.date ?? null, status: s?.status ?? null, receipt: s ? `/api/receipts/${s.id}` : null };
  });
  const appeal = one<Appeal>("SELECT * FROM appeals WHERE id=?", d.appeal_id)!;
  return { donation: d, appeal, rows, total_cents: rows.reduce((a, r) => a + r.cents, 0) };
}

export function ledger() {
  const ap = appeals(), sp = spends(), dn = donations(), po = payouts();
  const alloc = allocateFifo(dn as Don[], fundedSpends());
  return {
    appeals: ap.map((a) => ({ ...a,
      raised_cents: dn.filter((d) => d.appeal_id === a.id).reduce((s, d) => s + d.amount_cents, 0),
      spent_cents: sp.filter((s) => s.appeal_id === a.id && (s.status === "approved" || s.status === "paid")).reduce((s, x) => s + x.amount_cents, 0) })),
    spends: sp.map((s) => ({ ...s, line_items: JSON.parse(s.line_items), flags: JSON.parse(s.flags), receipt_hash: undefined,
      funded_by: alloc.filter((x) => x.spend_id === s.id).length, payout: po.find((p) => p.spend_id === s.id) ?? null })),
    donations: dn.map((d) => ({ id: d.id, appeal_id: d.appeal_id, donor_name: d.donor_name, amount_cents: d.amount_cents, source: d.source, created_at: d.created_at })),
  };
}
