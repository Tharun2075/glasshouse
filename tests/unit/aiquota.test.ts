import "./setup-db.ts";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { takeClaudeCall, limits, LIMIT_NOTE } from "../../lib/aiquota.ts";
import { clientIp } from "../../lib/ratelimit.ts";
import { db } from "../../lib/db.ts";

const req = (xff?: string) => new Request("http://127.0.0.1/api/x", { headers: xff ? { "x-forwarded-for": xff } : {} });
const day = new Date("2026-10-25T12:00:00Z");
const ENV = ["TRUST_PROXY", "TRUST_PROXY_HOPS", "CLAUDE_PER_IP_DAILY", "CLAUDE_PER_ACCOUNT_DAILY", "CLAUDE_DAILY_CAP"];
beforeEach(() => { db().exec("DROP TABLE IF EXISTS ai_usage"); process.env.TRUST_PROXY = "1"; });
afterEach(() => { for (const k of ENV) delete process.env[k]; });

describe("client IP parsing", () => {
  it("uses the rightmost hop behind a trusted proxy, ignoring a spoofed leftmost", () => {
    expect(clientIp(req("6.6.6.6, 1.2.3.4"))).toBe("1.2.3.4");
    expect(clientIp(req(" 1.2.3.4 "))).toBe("1.2.3.4");
  });
  it("TRUST_PROXY_HOPS skips our own proxies on the right", () => {
    process.env.TRUST_PROXY_HOPS = "1";
    expect(clientIp(req("6.6.6.6, 1.2.3.4, 10.0.0.1"))).toBe("1.2.3.4");
  });
  it("ignores headers without TRUST_PROXY", () => {
    delete process.env.TRUST_PROXY;
    expect(clientIp(req("1.2.3.4"))).toBeNull();
  });
});

describe("Claude daily allowance", () => {
  it("defaults: 15 per IP, 40 per account, 1000 overall", () => {
    expect(limits({})).toEqual({ perIp: 15, perAccount: 40, total: 1000 });
    expect(limits({ CLAUDE_PER_IP_DAILY: "3", CLAUDE_DAILY_CAP: "x" })).toMatchObject({ perIp: 3, total: 1000 });
  });
  it("per-IP: 16th call from one visitor is refused; another visitor is unaffected; spoofed leftmost does not reset", () => {
    for (let i = 0; i < 15; i++) expect(takeClaudeCall(req(`9.9.9.${i}, 1.1.1.1`), null, day).ok).toBe(true);
    const r = takeClaudeCall(req("8.8.8.8, 1.1.1.1"), null, day);
    expect(r).toEqual({ ok: false, reason: "visitor", note: LIMIT_NOTE });
    expect(takeClaudeCall(req("2.2.2.2"), null, day).ok).toBe(true);
  });
  it("resets on the next UTC day", () => {
    process.env.CLAUDE_PER_IP_DAILY = "1";
    expect(takeClaudeCall(req("1.1.1.1"), null, day).ok).toBe(true);
    expect(takeClaudeCall(req("1.1.1.1"), null, day).ok).toBe(false);
    expect(takeClaudeCall(req("1.1.1.1"), null, new Date("2026-10-26T00:00:01Z")).ok).toBe(true);
  });
  it("per-account: a signed-in judge behind a used-up shared IP still gets their own 40", () => {
    process.env.CLAUDE_PER_IP_DAILY = "2";
    for (let i = 0; i < 2; i++) takeClaudeCall(req("3.3.3.3"), null, day);
    expect(takeClaudeCall(req("3.3.3.3"), null, day).ok).toBe(false);
    for (let i = 0; i < 40; i++) expect(takeClaudeCall(req("3.3.3.3"), 7, day).ok).toBe(true);
    expect(takeClaudeCall(req("3.3.3.3"), 7, day)).toMatchObject({ ok: false, reason: "account" });
    // same shared demo login from another address has its own allowance
    expect(takeClaudeCall(req("4.4.4.4"), 7, day).ok).toBe(true);
  });
  it("no trusted IP: callers are not merged into one per-IP bucket; only the backstop counts", () => {
    delete process.env.TRUST_PROXY; process.env.CLAUDE_PER_IP_DAILY = "1"; process.env.CLAUDE_DAILY_CAP = "3";
    for (let i = 0; i < 3; i++) expect(takeClaudeCall(req(), null, day).ok).toBe(true);
    expect(takeClaudeCall(req(), null, day)).toMatchObject({ ok: false, reason: "total" });
  });
  it("overall backstop stops address-hopping", () => {
    process.env.CLAUDE_DAILY_CAP = "5";
    for (let i = 0; i < 5; i++) expect(takeClaudeCall(req(`5.5.5.${i}`), null, day).ok).toBe(true);
    expect(takeClaudeCall(req("5.5.5.99"), null, day)).toMatchObject({ ok: false, reason: "total" });
    expect(takeClaudeCall(req("5.5.5.98"), 3, day)).toMatchObject({ ok: false, reason: "total" });
  });
});

describe("route fallback over the limit (no network)", () => {
  it("nl-filter answers with the rules reader and the honest label once this visitor is over", async () => {
    const { POST } = await import("../../app/api/nl-filter/route.ts");
    process.env.CLAUDE_PER_IP_DAILY = "0"; process.env.ANTHROPIC_API_KEY = "test-not-a-key";
    try {
      const r = await POST(new Request("http://127.0.0.1/api/nl-filter", { method: "POST", body: JSON.stringify({ q: "food spends" }), headers: { "x-forwarded-for": "7.7.7.7" } }));
      const b = await r.json();
      expect(r.status).toBe(200); expect(b.by).toBe("rules"); expect(b.limit_note).toBe(LIMIT_NOTE);
    } finally { delete process.env.ANTHROPIC_API_KEY; }
  });
});
