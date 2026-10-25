import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { CATEGORIES, normCategory, normVendor } from "../../lib/categories.ts";
import { EXTRACT_PROMPT, ExtractionSchema, JSON_SCHEMA } from "../../lib/extract.ts";
import { SCHEMA as FILTER_SCHEMA } from "../../lib/nlfilter.ts";

const root = path.join(__dirname, "..", "..");
const json = (f: string) => JSON.parse(readFileSync(path.join(root, f), "utf8"));

describe("one category list", () => {
  it("extractor prompt names every category and the schema enum is the same list", () => {
    for (const c of CATEGORIES) expect(EXTRACT_PROMPT).toContain(c);
    expect((JSON_SCHEMA.properties.category as any).enum).toEqual([...CATEGORIES]);
  });
  it("filter schema offers the same list", () => {
    expect((FILTER_SCHEMA.properties.category as any).anyOf[0].enum).toEqual([...CATEGORIES]);
  });
  it("fixture manifest, seed data and the receipt generator only use listed categories", () => {
    const used = [...Object.values(json("data/fixtures/manifest.json")).map((e: any) => e.category),
      ...json("data/fixtures/seed-receipts.json").map((r: any) => r.extraction.category)];
    const py = readFileSync(path.join(root, "scripts/gen_receipts.py"), "utf8");
    used.push(...[...py.matchAll(/"\d{4}-\d{2}-\d{2}", "([^"]+)"/g)].map((m) => m[1]));
    expect(used.length).toBeGreaterThan(15);
    for (const c of used) expect(CATEGORIES, c).toContain(c);
  });
  it("normalises labels and vendors for comparison", () => {
    expect(normCategory(" Fuel ")).toBe("fuel");
    expect(normCategory("kitchen gear")).toBe("other");
    expect(ExtractionSchema.shape.category.parse("Equipment")).toBe("equipment");
    expect(normVendor("NORTHGATE FUEL STOP")).toBe(normVendor("Northgate Fuel  Stop."));
  });
});
