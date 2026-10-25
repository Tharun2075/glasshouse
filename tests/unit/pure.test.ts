import { describe, it, expect } from "vitest";
import { allocateFifo, traceDonation } from "../../lib/allocation.ts";
import { checkAnomaly } from "../../lib/anomaly.ts";
import { payoutGate } from "../../lib/gate.ts";
import { toCents, fmt } from "../../lib/money.ts";

const d = (id: number, c: number, t: string, appeal_id = 1) => ({ id, appeal_id, amount_cents: c, created_at: t });

describe("FIFO allocation", () => {
  it("oldest donation funds oldest spend, splitting across spends", () => {
    const a = allocateFifo([d(1, 2000, "a"), d(2, 2500, "b")], [d(10, 3000, "c"), d(11, 1000, "d")]);
    expect(a).toEqual([{ donation_id: 1, spend_id: 10, cents: 2000 }, { donation_id: 2, spend_id: 10, cents: 1000 }, { donation_id: 2, spend_id: 11, cents: 1000 }]);
  });
  it("T9: a $25 trace sums to exactly 2500 cents incl. unspent remainder", () => {
    const rows = traceDonation(d(2, 2500, "b"), [d(1, 2000, "a"), d(2, 2500, "b")], [d(10, 3000, "c")]);
    expect(rows.reduce((s, r) => s + r.cents, 0)).toBe(2500);
    expect(rows.at(-1)).toMatchObject({ spend_id: null, cents: 1500 });
  });
  it("never crosses appeals", () => {
    expect(allocateFifo([d(1, 5000, "a", 1)], [d(10, 100, "b", 2)])).toEqual([]);
  });
});

describe("anomaly rule", () => {
  it("T10: holds a spend over 3x the rolling mean with a reason", () => {
    const r = checkAnomaly(48000, [5000, 6000, 4000, 5000]);
    expect(r.held).toBe(true);
    expect(r.reason).toMatch(/3x the rolling mean \$50\.00/);
  });
  it("passes at exactly 3x and with short history", () => {
    expect(checkAnomaly(15000, [5000, 5000, 5000]).held).toBe(false);
    expect(checkAnomaly(999999, [100, 100]).held).toBe(false);
  });
});

describe("approval gate", () => {
  it("T7: no approval -> 403", () => {
    expect(payoutGate({ id: 1, status: "pending" }, 0)).toMatchObject({ ok: false, status: 403 });
    expect(payoutGate({ id: 1, status: "approved" }, 0)).toMatchObject({ ok: false, status: 403 });
    expect(payoutGate({ id: 1, status: "held" }, 1)).toMatchObject({ ok: false, status: 403 });
    expect(payoutGate(undefined, 1)).toMatchObject({ ok: false, status: 403 });
  });
  it("approved with an approval row -> ok", () => { expect(payoutGate({ id: 1, status: "approved" }, 1)).toEqual({ ok: true }); });
});

describe("money", () => {
  it("parses to integer cents without float drift", () => {
    expect(toCents("0.10") + toCents("0.20")).toBe(30);
    expect(toCents(19.99)).toBe(1999);
    expect(fmt(2500)).toBe("25.00");
    expect(() => toCents("1.234")).toThrow();
  });
});

describe("session cookie (N4)", () => {
  it("adds Secure only when APP_ORIGIN is https", async () => {
    const { cookieAttrs } = await import("@/lib/auth.ts");
    const old = process.env.APP_ORIGIN;
    process.env.APP_ORIGIN = "https://glasshouse.example"; expect(cookieAttrs()).toContain("; Secure");
    process.env.APP_ORIGIN = "http://127.0.0.1:3000"; expect(cookieAttrs()).not.toContain("Secure");
    process.env.APP_ORIGIN = old;
  });
});
