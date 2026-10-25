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
