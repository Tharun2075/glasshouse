import "./setup-db.ts";
import { describe, it, expect, vi } from "vitest";
import { run, all, one } from "../../lib/db.ts";
import { addSpend, approveSpend, requestPayout, captureDonation, trace } from "../../lib/ledger.ts";

run("INSERT INTO orgs(id,name) VALUES(1,'Test Org')");
run("INSERT INTO appeals(id,org_id,title,goal_cents,item_cap_cents) VALUES(1,1,'Food',100000,30000)");
run("INSERT INTO users(id,email,name,role,pw) VALUES(1,'t@x.test','T','trustee','x')");
const ext = (vendor: string, amount: number, date = "2026-10-01") => ({ vendor, date, amount, currency: "USD", category: "food", line_items: [], confidence: 0.9 });
let n = 0;
const add = (v: string, amt: number, hash = `h${n++}`) => addSpend(1, ext(v, amt, `2026-10-${String(10 + n).padStart(2, "0")}`), "mock", "f.png", hash, null);

describe("upload never auto-pays (T6) + flags", () => {
  it("clean upload is pending, never approved", () => { expect(add("Shop A", 50).status).toBe("pending"); });
  it("duplicate hash is held", () => {
    add("Shop B", 60, "dup"); const s = add("Shop C", 61, "dup");
    expect(s.status).toBe("held"); expect(JSON.parse(s.flags)).toContain("duplicate");
  });
  it("over cap is held", () => { const s = add("Shop D", 400); expect(JSON.parse(s.flags)).toContain("over_cap"); expect(s.status).toBe("held"); });
  it("anomaly is held with reason", () => { add("E", 50); const s = add("F", 290); expect(s.hold_reason).toMatch(/rolling mean/); });
});

describe("payout gate + exactly one batch", () => {
  it("T7: payout without approval -> 403 and createPayout never called", async () => {
    const s = add("Gate shop", 40); const cp = vi.fn();
    const r = await requestPayout(s.id, "r@x.test", cp);
    expect(r.status).toBe(403); expect(cp).not.toHaveBeenCalled();
    expect(one("SELECT * FROM payouts WHERE spend_id=?", s.id)).toBeUndefined();
  });
  it("T8 logic: approve twice -> one createPayout call, one row", async () => {
    const s = add("Pay shop", 45); const cp = vi.fn(async () => ({ batchId: "B1", status: "PENDING", http: 201, body: {}, debugId: null }));
    const a = await approveSpend(s.id, 1, cp); const b = await approveSpend(s.id, 1, cp);
    expect(a.status).toBe(201); expect(b.body.replay).toBe(true);
    expect(cp).toHaveBeenCalledTimes(1);
    expect(all("SELECT * FROM payouts WHERE spend_id=?", s.id)).toHaveLength(1);
  });
  it("held spend cannot be approved", async () => {
    const held = one<{ id: number }>("SELECT id FROM spends WHERE status='held' LIMIT 1")!; const cp = vi.fn();
    expect((await approveSpend(held.id, 1, cp)).status).toBe(403); expect(cp).not.toHaveBeenCalled();
  });
});

describe("capture idempotency (T5 logic) + amount check", () => {
  const ins = (oid: string, c: number) => run("INSERT INTO donations(appeal_id,donor_name,amount_cents,order_id,status,created_at) VALUES(1,'D',?,?,'CREATED',?)", c, oid, new Date().toISOString());
  it("replayed capture calls PayPal once and counts once", async () => {
    ins("O1", 2500);
    const cap = vi.fn(async () => ({ status: "COMPLETED", captureId: "C1", captured: { value: "25.00", currency_code: "USD" }, http: 201, body: {}, debugId: null }));
    expect((await captureDonation("O1", cap)).status).toBe(201);
    expect((await captureDonation("O1", cap)).body.replay).toBe(true);
    expect(cap).toHaveBeenCalledTimes(1);
    expect(all("SELECT * FROM donations WHERE order_id='O1' AND status='COMPLETED'")).toHaveLength(1);
  });
  it("captured amount must equal item total", async () => {
    ins("O2", 2500);
    const cap = vi.fn(async () => ({ status: "COMPLETED", captureId: "C2", captured: { value: "2.50", currency_code: "USD" }, http: 201, body: {}, debugId: null }));
    expect((await captureDonation("O2", cap)).status).toBe(409);
  });
  it("trace sums to the donation", () => {
    const d = one<{ id: number }>("SELECT id FROM donations WHERE order_id='O1'")!;
    expect(trace(d.id)!.total_cents).toBe(2500);
  });
});
