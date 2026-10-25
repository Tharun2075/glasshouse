import { describe, it, expect, vi } from "vitest";
import { ClaudeExtractor, ExtractionSchema, JSON_SCHEMA, MODEL, MockExtractor, sha256 } from "../../lib/extract.ts";
import { nlToFilter, ruleIntent, toFilterModel } from "../../lib/nlfilter.ts";

const good = { vendor: "Corner Grocer", date: "2026-10-02", amount: 42.5, currency: "USD", category: "food", line_items: [{ description: "rice", amount: 42.5 }], confidence: 0.93 };
const client = (text: string, stop_reason = "end_turn") => ({ messages: { create: vi.fn(async () => ({ stop_reason, content: [{ type: "text", text }] })) } });

describe("Claude extraction (mocked client)", () => {
  it("sends the image with the json_schema output format and parses the result", async () => {
    const c = client(JSON.stringify(good));
    const r = await new ClaudeExtractor(c).extract(Buffer.from("png"));
    expect(r).toEqual({ data: good, by: "claude" });
    const body = (c.messages.create as any).mock.calls[0][0];
    expect(body.model).toBe(MODEL);
    expect(body.output_config.format).toEqual({ type: "json_schema", schema: JSON_SCHEMA });
    expect(body.messages[0].content[0]).toMatchObject({ type: "image", source: { media_type: "image/png" } });
  });
  it("rejects output that breaks the schema, and refusals", async () => {
    await expect(new ClaudeExtractor(client(JSON.stringify({ ...good, date: "2 Oct" }))).extract(Buffer.from("x"))).rejects.toThrow();
    await expect(new ClaudeExtractor(client("", "refusal")).extract(Buffer.from("x"))).rejects.toThrow(/refused/);
  });
  it("JSON schema and zod schema list the same fields", () => {
    expect(Object.keys(ExtractionSchema.shape).sort()).toEqual([...JSON_SCHEMA.required].sort());
  });
  it("mock extractor answers by image hash and labels itself", async () => {
    const png = Buffer.from("fixture");
    const r = await new MockExtractor({ [sha256(png)]: good }).extract(png);
    expect(r.by).toBe("mock"); expect(r.data.vendor).toBe("Corner Grocer");
    expect((await new MockExtractor({}).extract(Buffer.from("other"))).data.confidence).toBe(0);
  });
});

describe("NL -> AG Grid filter", () => {
  it("rules fallback turns 'spends over $100' into a number filter", async () => {
    const m = toFilterModel(ruleIntent("spends over $100")) as any;
    expect(m.amount).toMatchObject({ filterType: "number", type: "greaterThan", filter: 100 });
  });
  it("uses Claude when a client is given", async () => {
    const c = client(JSON.stringify(ruleIntent("held spends")));
    const r = await nlToFilter("held spends", c);
    expect(r.by).toBe("claude");
  });
});
