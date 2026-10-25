import "./setup-db.ts";
import { describe, it, expect, vi } from "vitest";
import { run, all, one } from "../../lib/db.ts";
import { addSpend, approveSpend, requestPayout, captureDonation, trace, available } from "../../lib/ledger.ts";

run("INSERT INTO orgs(id,name) VALUES(1,'Test Org')");
run("INSERT INTO appeals(id,org_id,title,goal_cents,item_cap_cents) VALUES(1,1,'Food',100000,30000)");
run("INSERT INTO users(id,email,name,role,pw) VALUES(1,'t@x.test','T','trustee','x')");
run("INSERT INTO appeals(id,org_id,title,goal_cents,item_cap_cents) VALUES(2,1,'Fuel',100000,30000)");
// $1000 raised for appeal 1 so approvals in these tests are funded (D5 funds check)
run("INSERT INTO donations(appeal_id,donor_name,amount_cents,order_id,status,created_at) VALUES(1,'Seed',100000,'SEEDFUND','COMPLETED','2026-01-01T00:00:00Z')");
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
  it("anomaly is held with reason (baseline = approved/paid only)", () => { for (const v of [50, 55, 45]) run("UPDATE spends SET status='approved' WHERE id=?", add("E" + v, v).id); const s = add("F", 290); expect(s.hold_reason).toMatch(/rolling mean/); });
});

describe("unreadable receipts are held (D1)", () => {
  it("$0 extraction is held with a reason and cannot be approved or paid", async () => {
    const s = add("Unreadable receipt (mock)", 0);
    expect(s.status).toBe("held"); expect(s.hold_reason).toMatch(/no amount/); expect(JSON.parse(s.flags)).toContain("no_amount");
    const cp = vi.fn();
    expect((await approveSpend(s.id, 1, cp)).status).toBe(403);
    expect((await requestPayout(s.id, "r@x.test", cp)).status).toBe(403);
    expect(cp).not.toHaveBeenCalled();
  });
  it("low confidence is held with the confidence in the reason", () => {
    const s = addSpend(1, { ...ext("Blurry Mart", 20, "2026-09-01"), confidence: 0.3 }, "mock", "f.png", "lowconf", null);
    expect(s.status).toBe("held"); expect(s.hold_reason).toMatch(/hard to read \(confidence 0\.30/);
  });
  it("a $0 spend forced to pending still gets 422 on approve", async () => {
    const s = add("Zero forced", 0); run("UPDATE spends SET status='pending' WHERE id=?", s.id); const cp = vi.fn();
    expect((await approveSpend(s.id, 1, cp)).status).toBe(422); expect(cp).not.toHaveBeenCalled();
  });
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
    // D4: the captured money is recorded, not lost in a CREATED row
    const d = one<{ status: string; capture_id: string; captured_value: string }>("SELECT * FROM donations WHERE order_id='O2'")!;
    expect(d.status).toBe("MISMATCH"); expect(d.capture_id).toBe("C2"); expect(d.captured_value).toBe("2.50 USD");
    expect((await captureDonation("O2", cap)).status).toBe(409); expect(cap).toHaveBeenCalledTimes(1);
  });
  it("trace sums to the donation", () => {
    const d = one<{ id: number }>("SELECT id FROM donations WHERE order_id='O1'")!;
    const t = trace(d.id)!;
    expect(t.total_cents).toBe(2500);
    // public trace never exposes PayPal ids or the donor account id
    expect(t.donation).not.toHaveProperty("order_id"); expect(t.donation).not.toHaveProperty("capture_id"); expect(t.donation).not.toHaveProperty("donor_id");
  });
});

describe("funds, anomaly baseline and payout retry (D5, D12, D11)", () => {
  it("D5: approval over money raised -> 409, no payout", async () => {
    run("INSERT INTO donations(appeal_id,donor_name,amount_cents,order_id,status,created_at) VALUES(2,'F',5000,'FUEL1','COMPLETED','2026-01-01T00:00:00Z')");
    const s = addSpend(2, ext("Fuel stop", 80, "2026-10-01"), "mock", "f.png", "fuel80", null); const cp = vi.fn();
    expect(s.status).toBe("pending");
    const r = await approveSpend(s.id, 1, cp);
    expect(r.status).toBe(409); expect(String(r.body.error)).toMatch(/not enough raised/);
    expect(cp).not.toHaveBeenCalled(); expect(one<{ status: string }>("SELECT status FROM spends WHERE id=?", s.id)!.status).toBe("pending");
    const ok = addSpend(2, ext("Fuel stop 2", 30, "2026-10-02"), "mock", "f.png", "fuel30", null);
    const cp2 = vi.fn(async () => ({ batchId: "BF", status: "PENDING", http: 201, body: {}, debugId: null }));
    expect((await approveSpend(ok.id, 1, cp2)).status).toBe(201); expect(available(2)).toBe(2000);
  });
  it("D12: pending spends do not shape the anomaly baseline", () => {
    run("INSERT INTO appeals(id,org_id,title,goal_cents,item_cap_cents) VALUES(3,1,'Van',100000,90000)");
    for (const [i, a] of [100, 110, 90].entries()) addSpend(3, ext(`P${i}`, a, `2026-08-0${i + 1}`), "mock", "f.png", `pend${i}`, null);
    // with only pending (unapproved) history there is no baseline yet, so a large spend is not called an anomaly
    const s = addSpend(3, ext("Big", 800, "2026-08-09"), "mock", "f.png", "pendbig", null);
    expect(JSON.parse(s.flags)).not.toContain("anomaly");
  });
  it("D11: a payout that errored before PayPal answered can be retried, once", async () => {
    const s = add("Retry shop", 20);
    const bad = vi.fn(async () => { throw new Error("network down"); });
    await approveSpend(s.id, 1, bad);
    expect(one<{ status: string }>("SELECT status FROM payouts WHERE spend_id=?", s.id)!.status).toMatch(/^ERROR/);
    const good = vi.fn(async () => ({ batchId: "BR", status: "PENDING", http: 201, body: {}, debugId: null }));
    expect((await requestPayout(s.id, "r@x.test", good)).status).toBe(201);
    expect((await requestPayout(s.id, "r@x.test", good)).body.replay).toBe(true);
    expect(good).toHaveBeenCalledTimes(1); expect(all("SELECT * FROM payouts WHERE spend_id=?", s.id)).toHaveLength(1);
  });
});
