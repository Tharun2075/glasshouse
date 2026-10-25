// Receipt extraction. Real path: Claude (claude-sonnet-5-5) vision with a JSON schema.
// Without ANTHROPIC_API_KEY a deterministic MOCK answers from the fixture manifest by image hash; it is labelled "mock" everywhere.
import { z } from "zod";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export const MODEL = "claude-sonnet-5-5";
export const ExtractionSchema = z.object({
  vendor: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
  category: z.string().min(1),
  line_items: z.array(z.object({ description: z.string(), amount: z.number() })),
  confidence: z.number().min(0).max(1),
});
export type Extraction = z.infer<typeof ExtractionSchema>;
export type ExtractResult = { data: Extraction; by: "claude" | "mock" };

export const JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["vendor", "date", "amount", "currency", "category", "line_items", "confidence"],
  properties: {
    vendor: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, amount: { type: "number" },
    currency: { type: "string", description: "ISO 4217" }, category: { type: "string" },
    line_items: { type: "array", items: { type: "object", additionalProperties: false, required: ["description", "amount"], properties: { description: { type: "string" }, amount: { type: "number" } } } },
    confidence: { type: "number", description: "0..1, your confidence the fields are right" },
  },
};

export interface Extractor { extract(png: Buffer): Promise<ExtractResult> }

export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

export class MockExtractor implements Extractor {
  constructor(private manifest: Record<string, Extraction>) {}
  static fromDisk(dir = path.join(process.cwd(), "data", "fixtures")) {
    const f = path.join(dir, "manifest.json");
    return new MockExtractor(existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {});
  }
  async extract(png: Buffer): Promise<ExtractResult> {
    const hit = this.manifest[sha256(png)];
    const data = hit ?? { vendor: "Unreadable receipt (mock)", date: new Date().toISOString().slice(0, 10), amount: 0, currency: "USD", category: "uncategorised", line_items: [], confidence: 0 };
    return { data: ExtractionSchema.parse(data), by: "mock" };
  }
}

type MessagesClient = { messages: { create(body: any): Promise<any> } };

export class ClaudeExtractor implements Extractor {
  constructor(private client: MessagesClient) {}
  async extract(png: Buffer): Promise<ExtractResult> {
    const msg = await this.client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      output_config: { format: { type: "json_schema", schema: JSON_SCHEMA } },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: png.toString("base64") } },
        { type: "text", text: "Extract this charity expense receipt. amount is the receipt total. category is one of: food, supplies, transport, utilities, other. Give line_items as printed." },
      ] }],
    });
    if (msg.stop_reason === "refusal") throw new Error("model refused the receipt");
    const text = (msg.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    return { data: ExtractionSchema.parse(JSON.parse(text)), by: "claude" };
  }
}

export async function defaultExtractor(): Promise<Extractor> {
  if (!process.env.ANTHROPIC_API_KEY) return MockExtractor.fromDisk();
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new ClaudeExtractor(new Anthropic() as unknown as MessagesClient);
}
