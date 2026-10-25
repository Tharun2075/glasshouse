import "./setup-db.ts";
import { describe, it, expect } from "vitest";
import { limit } from "../../lib/ratelimit.ts";
import { POST } from "../../app/api/nl-filter/route.ts";

const req = (body: unknown = { q: "food spends" }) => new Request("http://127.0.0.1/api/nl-filter", { method: "POST", body: JSON.stringify(body) });
describe("rate limit + q cap (D9)", () => {
  it("11th call in a minute is 429 with retry-after", async () => {
    for (let i = 0; i < 10; i++) expect(await limit("t", req())).toBeNull();
    const r = await limit("t", req()); expect(r!.status).toBe(429); expect(r!.headers.get("retry-after")).toBeTruthy();
  });
  it("nl-filter refuses q over 200 chars", async () => {
    expect((await POST(req({ q: "x".repeat(201) }))).status).toBe(413);
  });
});
