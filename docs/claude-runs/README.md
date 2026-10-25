# Live Claude runs (2026-10-25)

Real calls to `claude-sonnet-5-5` through the app's own code: receipts via `ClaudeExtractor` + `addSpend` (lib/extract.ts, lib/ledger.ts), questions via `nlToFilter` (lib/nlfilter.ts). Script: `scripts/live-claude-run.ts`. Raw responses and expected values sit side by side in each JSON file.

Expected values come from `data/fixtures/manifest.json` (the generator's own truth). `unreadable.png` is a deliberately blurred, noisy copy of r3 with no expected fields; its only expected outcome is HELD.

## Receipt reading (5 receipts)

| # | receipt | vendor | date | amount | currency | category | line items | confidence | ledger result | request_id | time (UTC) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | r1.png | match | match | match | match | match | match | 0.97 | PENDING | `req_011CgNHC5tY4JyxKVdDxv6Yk` | 2026-10-25T03:54:40 |
| 2 | r4.png | match | match | match | match | MISMATCH: `supplies` vs `Equipment` | match | 0.97 | PENDING | `req_011CgNHCKvd5U6de1v49K6Sn` | 2026-10-25T03:54:44 |
| 3 | r5.png | MISMATCH: `NORTHGATE FUEL STOP` vs `Northgate Fuel Stop` | match | match | match | MISMATCH: `transport` vs `Fuel` | match | 0.95 | PENDING | `req_011CgNHCToeEZa8yPL3T2ckj` | 2026-10-25T03:54:46 |
| 4 | upload-sample.png | match | match | match | match | match | match | 0.97 | PENDING | `req_011CgNHCajreywgApkdYeFHc` | 2026-10-25T03:54:47 |
| 5 | unreadable.png | (none expected) | (none expected) | (none expected) | (none expected) | (none expected) | (none expected) | 0 | HELD (no_amount, low_confidence) | `req_011CgNHGGDWDrtRsYRQXJJV4` | 2026-10-25T03:55:37 |

**Readable receipts: 21/24 fields match** (4 receipts x 6 fields). The mismatches are honest ones:

- **category**: the prompt asks Claude for one of food / supplies / transport / utilities / other, but the fixtures say `Equipment` and `Fuel`. Claude answered `supplies` and `transport`, which follow the prompt. `Food` vs `food` differ only in case and are counted as a match.
- **vendor (r5)**: Claude copied the printed header `NORTHGATE FUEL STOP` in capitals; the manifest has `Northgate Fuel Stop`. The duplicate check compares vendors with `lower()`, so this does not break it.
- Every date, amount, currency and line item matched exactly.

**Unreadable receipt:** Claude returned vendor `""`, date `""`, amount 0, confidence 0. The first live run (same day) showed the app then **rejected** the upload with a schema error (HTTP 422, nothing saved). It was never payable, but a trustee never saw it either. Fixed in lib/extract.ts: any answer that breaks the schema is kept as an `Unreadable receipt` with $0 and confidence 0, and the ledger **holds** it (`no_amount`, `low_confidence`). The rerun above shows HELD.

## Plain English -> grid filter (3 questions)

| # | question | Claude's filter | expected | verdict | request_id |
|---|---|---|---|---|---|
| 1 | food over 20 dollars last month | `{"category": "food", "min_amount": 20}` | `{"category": "food", "min_amount": 20}` | partial: food + over 20 right; the filter has no date field, so 'last month' is dropped | `req_011CgNHGRNuzfg1SsYXxrg7P` |
| 2 | unpaid receipts from Fresh Mart | `{"vendor": "Fresh Mart"}` | `{"vendor": "Fresh Mart", "status": "pending or held (unpaid is not one status)"}` | partial: vendor right; 'unpaid' means pending OR held, and the filter can only hold one status, so Claude left status empty | `req_011CgNHGc2ranhMySr2nH8Qs` |
| 3 | held spends for kitchen equipment under $400 | `{"status": "held", "category": "kitchen equipment", "max_amount": 400}` | `{"status": "held", "appeal": "kitchen equipment", "max_amount": 400}` | partial: held + under 400 right; 'kitchen equipment' went to category, not appeal, so it matches nothing (no spend has that category) | `req_011CgNHGnqk1F4xnUuQTSw7W` |

**First live run found a real bug:** all 3 questions failed with HTTP 400 (`Enum value 'pending' does not match declared type ['string','null']`; request ids req_011CgNHCopucRier66jsiE3N, req_011CgNHCqBmfJScH3LTF8Pei, req_011CgNHCrVeRQcNiMssA7423). Before this, the Claude filter path had only been run against a mocked client. Fixed by writing `status` as `anyOf` (lib/nlfilter.ts), with a unit test that stops the old shape from coming back. The table shows the rerun.

## Cost

12 API calls in all: 8 in the first run and 4 in the rerun of the 4 failing items. Rows with no key still use the demo reader and the rule parser, and they are labelled that way.


## Run 2 (2026-10-25, after round-2 fixes): files in `run2/`

This run used the same 5 receipts and the same 3 questions, plus 2 new questions (a date range and a status word). Everything went through the same app code: `ClaudeExtractor` + `addSpend` for receipts, and `nlToFilter` with the real appeal titles for questions. "Today" was pinned to 2026-10-25 so the date answers can be checked.

Command: `LIVE_RUN=run2 LIVE_TODAY=2026-10-25 node --experimental-strip-types scripts/live-claude-run.ts`.

The script scores itself:
- Vendors are compared ignoring case and punctuation (`normVendor`).
- Categories are compared via `normCategory`.
- A filter is **full** only if every expected field matches and every other field is empty.

What changed since run 1:
- One shared category list (`lib/categories.ts`: food, supplies, equipment, fuel, transport, utilities, other), used by the prompt, the schema, the seed and the manifest.
- The prompt asks for vendor names in Title Case.
- The filter gained date_from/date_to, a status list (unpaid = pending + held + approved), and an appeal field matched to a hidden Appeal column. Claude is given the appeal titles.

| # | receipt | fields | vendor | category | confidence | ledger result | request_id | time (UTC) |
|---|---|---|---|---|---|---|---|---|
| 1 | r1.png | 6/6 | `Greenfield Wholesale Foods` | `food` | 0.97 | PENDING | `req_011CgNJDmTvosdNTXCtBSUPP` | 2026-10-25T04:08:10 |
| 2 | r4.png | 6/6 | `Hearth Kitchen Supply` | `equipment` | 0.97 | PENDING | `req_011CgNJE1ZFtQoyNfMEsKYtb` | 2026-10-25T04:08:13 |
| 3 | r5.png | 6/6 | `Northgate Fuel Stop` | `fuel` | 0.97 | PENDING | `req_011CgNJE9Mp3q2KmTEmqyZvh` | 2026-10-25T04:08:15 |
| 4 | upload-sample.png | 6/6 | `Corner Market Co-op` | `food` | 0.97 | PENDING | `req_011CgNJEGTwooMDJhASgoDYV` | 2026-10-25T04:08:17 |
| 5 | unreadable.png | (none expected) | `Unreadable receipt` | `other` | 0 | HELD (Held: no amount could be read from this receipt ($0.00); re-upload a clearer photo · Held: receipt is hard to read (confidence 0.00, need 0.5); check it by hand) | `req_011CgNJEQNh1jsTaxiX8LNXs` | 2026-10-25T04:08:19 |

**Readable receipts: 24/24 fields match** (run 1: 21/24). r4 now reads `equipment` and r5 reads `fuel`, both from the shared list. The r5 vendor came back in Title Case. The unreadable receipt is still kept and HELD, never payable.

| # | question | Claude's filter (non-empty fields) | verdict | request_id |
|---|---|---|---|---|
| 1 | food over 20 dollars last month | `{"category": "food", "min_amount": 20, "date_from": "2026-09-01", "date_to": "2026-09-30"}` | full | `req_011CgNJEVZjLaruwQLdGkhXg` |
| 2 | unpaid receipts from Fresh Mart | `{"statuses": ["pending", "held", "approved"], "vendor": "Fresh Mart"}` | full | `req_011CgNJEgouiswumHazLwqGW` |
| 3 | held spends for kitchen equipment under $400 | `{"statuses": ["held"], "appeal": "Kitchen Equipment", "max_amount": 400}` | full | `req_011CgNJEo6gRDF8wxCrB4gDJ` |
| 4 | receipts since 1 Oct over $50 | `{"min_amount": 50, "date_from": "2026-10-01", "date_to": "2026-10-25"}` | full | `req_011CgNJEv2tmmAQhZSPrGUkM` |
| 5 | paid spends for Winter Food Parcels | `{"statuses": ["paid"], "appeal": "Winter Food Parcels"}` | full | `req_011CgNJF1hTzhUeR5WqRadWu` |

**Filters: 5/5 full** (run 1: 0/3 full, 3 partial). Questions 4 and 5 are new. The no-key rule parser gives the same 5 answers (unit test `tests/unit/nlfilter.test.ts`).

Run 2 cost: 10 API calls (5 receipts + 5 questions). Run 1 files stay in this folder as history.
