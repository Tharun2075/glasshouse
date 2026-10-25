import { describe, it, expect } from "vitest";
import { dateRange, parseDate, statusWords, matchAppeal, ruleIntent, toFilterModel, nlToFilter, filterPrompt, SCHEMA, UNPAID } from "../../lib/nlfilter.ts";

const TODAY = "2026-10-25"; // a Sunday
const APPEALS = ["Winter Food Parcels", "Kitchen Equipment", "Delivery Van Fuel"];
const opts = { today: TODAY, appeals: APPEALS };
const fake = (reply: unknown) => { const seen: any[] = []; return { seen, messages: { async create(b: any) { seen.push(b); return { stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(reply) }] }; } } }; };

describe("date ranges (no network)", () => {
  it("last month = whole previous calendar month", () => expect(dateRange("food last month", TODAY)).toMatchObject({ from: "2026-09-01", to: "2026-09-30" }));
  it("this month / this week / last week", () => {
    expect(dateRange("this month", TODAY)).toMatchObject({ from: "2026-10-01", to: TODAY });
    expect(dateRange("this week", TODAY)).toMatchObject({ from: "2026-10-19", to: TODAY });
    expect(dateRange("last week", TODAY)).toMatchObject({ from: "2026-10-12", to: "2026-10-18" });
  });
  it("since 1 Oct / since October 1st / from 2026-10-01 run to today", () => {
    for (const q of ["since 1 Oct", "since October 1st", "from 2026-10-01", "after oct 1"]) expect(dateRange(q, TODAY), q).toMatchObject({ from: "2026-10-01", to: TODAY });
  });
  it("between two dates, last N days, before, in a month", () => {
    expect(dateRange("between 1 Sep and 15 Sep", TODAY)).toMatchObject({ from: "2026-09-01", to: "2026-09-15" });
    expect(dateRange("last 7 days", TODAY)).toMatchObject({ from: "2026-10-18", to: TODAY });
    expect(dateRange("before 1 Oct", TODAY)).toMatchObject({ from: null, to: "2026-09-30" });
    expect(dateRange("in september", TODAY)).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
  });
  it("a yearless date in the future means last year; no date words = null", () => {
    expect(parseDate("1 Dec", TODAY)).toBe("2025-12-01");
    expect(parseDate("31 Feb", TODAY)).toBeNull();
    expect(dateRange("held spends over $50", TODAY)).toBeNull();
  });
});

describe("status words (no network)", () => {
  it("unpaid never means paid", () => {
    expect(statusWords("unpaid receipts")).toEqual([...UNPAID]);
    expect(statusWords("not paid yet")).toEqual([...UNPAID]);
    expect(statusWords("unpaid")).not.toContain("paid");
  });
  it("paid / held / pending / flagged map to the status column", () => {
    expect(statusWords("paid spends")).toEqual(["paid"]);
    expect(statusWords("held spends")).toEqual(["held"]);
    expect(statusWords("flagged receipts")).toEqual(["held"]);
    expect(statusWords("pending or held")).toEqual(["pending", "held"]);
  });
  it("several statuses become one OR filter (grid allows 5 conditions)", () => {
    const m = toFilterModel(ruleIntent("unpaid receipts", opts)) as any;
    expect(m.status).toMatchObject({ filterType: "text", operator: "OR" });
    expect(m.status.conditions.map((c: any) => c.filter)).toEqual([...UNPAID]);
  });
});

describe("appeal vs category (no network)", () => {
  it("an appeal name goes to appeal, and its words are not read as a category", () => {
    const i = ruleIntent("held spends for kitchen equipment under $400", opts);
    expect(i).toMatchObject({ appeal: "Kitchen Equipment", category: null, statuses: ["held"], max_amount: 400 });
    expect(toFilterModel(i)).toMatchObject({ appeal: { filterType: "text", type: "contains", filter: "Kitchen Equipment" } });
  });
  it("a category word alone stays a category", () => expect(ruleIntent("equipment over $100", opts)).toMatchObject({ appeal: null, category: "equipment" }));
  it("matchAppeal needs every title word", () => { expect(matchAppeal("van fuel delivery", APPEALS)).toBe("Delivery Van Fuel"); expect(matchAppeal("fuel", APPEALS)).toBeNull(); });
});

describe("the three live questions + two new ones, rules fallback", () => {
  it("food over 20 dollars last month", () => expect(ruleIntent("food over 20 dollars last month", opts)).toMatchObject({ category: "food", min_amount: 20, date_from: "2026-09-01", date_to: "2026-09-30" }));
  it("unpaid receipts from Fresh Mart", () => expect(ruleIntent("unpaid receipts from Fresh Mart", opts)).toMatchObject({ vendor: "fresh mart", statuses: [...UNPAID] }));
  it("receipts since 1 Oct over $50 -> inclusive date filter", () => {
    const m = toFilterModel(ruleIntent("receipts since 1 Oct over $50", opts)) as any;
    expect(m.date).toEqual({ filterType: "date", type: "inRange", dateFrom: "2026-10-01", dateTo: TODAY });
    expect(m.amount).toMatchObject({ type: "greaterThan", filter: 50 });
  });
  it("vendor names stop before date words", () => expect(ruleIntent("spends at Fresh Mart this week", opts)).toMatchObject({ vendor: "fresh mart", date_from: "2026-10-19" }));
});

describe("Claude path (fake client, no network)", () => {
  it("prompt carries today, the appeal names, the unpaid rule and appeal-is-not-category", () => {
    const p = filterPrompt("x", TODAY, APPEALS);
    for (const w of [`Today is ${TODAY}`, '"Kitchen Equipment"', "unpaid", "An appeal name is not a category", "last month"]) expect(p).toContain(w);
  });
  it("schema asks for statuses array and both date ends", () => {
    expect(SCHEMA.required).toEqual(expect.arrayContaining(["statuses", "date_from", "date_to", "appeal"]));
    expect((SCHEMA.properties.statuses as any).items.enum).toContain("held");
  });
  it("snaps appeal case to the real title and closes an open date range at today", async () => {
    const c = fake({ statuses: ["held"], vendor: null, category: null, appeal: "kitchen equipment", min_amount: null, max_amount: 400, date_from: "2026-10-01", date_to: null });
    const r = await nlToFilter("held kitchen equipment since 1 oct under 400", c, opts);
    expect(r.by).toBe("claude");
    expect(r.intent).toMatchObject({ appeal: "Kitchen Equipment", date_to: TODAY });
    expect(c.seen[0].messages[0].content).toContain("Kitchen Equipment");
  });
  it("rejects a non-ISO date from the model instead of filtering wrongly", async () => {
    const c = fake({ statuses: [], vendor: null, category: null, appeal: null, min_amount: null, max_amount: null, date_from: "Oct 1", date_to: null });
    await expect(nlToFilter("since oct 1", c, opts)).rejects.toThrow();
  });
});
