// One category list for the whole app: the extractor prompt + JSON schema, the filter schema, the seed data and the
// fixture manifest all use it (tests/unit/categories.test.ts checks). Live run 2026-10-25: a narrower prompt list made
// Claude file "Equipment" receipts as supplies and "Fuel" as transport.
export const CATEGORIES = ["food", "supplies", "equipment", "fuel", "transport", "utilities", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Any label (fixture "Fuel", model "Food ", old rows) -> one of CATEGORIES; unknown words become "other". */
export function normCategory(s: string): Category {
  const k = s.trim().toLowerCase();
  return (CATEGORIES as readonly string[]).includes(k) ? (k as Category) : "other";
}

/** Vendor key for comparisons: case, spacing and punctuation do not matter ("NORTHGATE FUEL STOP" = "Northgate Fuel Stop"). */
export const normVendor = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
