import "./setup-db.ts";
import { describe, it, expect } from "vitest";
import { limit } from "../../lib/ratelimit.ts";
import { POST } from "../../app/api/nl-filter/route.ts";

const req = (body: unknown = { q: "food spends" }, xff?: string) =>
  new Request("http://127.0.0.1/api/nl-filter", { method: "POST", body: JSON.stringify(body), headers: xff ? { "x-forwarded-for": xff } : {} });
describe("rate limit + q cap (D9)", () => {
  it("behind a trusted proxy: 11th call per IP is 429; spoofed leftmost hop does not reset it; other IPs unaffected", async () => {
    process.env.TRUST_PROXY = "1";
    for (let i = 0; i < 10; i++) expect(await limit("t", req(undefined, `9.9.9.${i}, 1.2.3.4`))).toBeNull();
    const r = await limit("t", req(undefined, "8.8.8.8, 1.2.3.4")); expect(r!.status).toBe(429); expect(r!.headers.get("retry-after")).toBeTruthy();
    expect(await limit("t", req(undefined, "5.6.7.8"))).toBeNull();
    delete process.env.TRUST_PROXY;
  });
  it("no trusted proxy: headers ignored, shared bucket capped at 60/min", async () => {
    for (let i = 0; i < 60; i++) expect(await limit("g", req(undefined, `7.7.7.${i}`))).toBeNull();
    expect((await limit("g", req()))!.status).toBe(429);
  });
  it("nl-filter refuses q over 200 chars", async () => {
    expect((await POST(req({ q: "x".repeat(201) }))).status).toBe(413);
  });
});
