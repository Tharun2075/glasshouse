# Glasshouse

Glasshouse is a glass-walled ledger for small charities: donors give through PayPal, volunteers upload receipts that Claude reads, and trustees approve each spend before a PayPal payout goes out.
Every donation is matched first-in-first-out to the spends it paid for, so any donor can open "where did my $25 go?" and see the exact receipts.
Spends that look like duplicates, go over an appeal's per-item cap, or run above 3x the appeal's rolling mean are held in red and never paid.

**Sandbox only.** All PayPal calls go to `api-m.sandbox.paypal.com`; no real money moves.

## Run

```bash
npm ci
cp .env.example .env.local   # fill in sandbox PayPal client id/secret; ANTHROPIC_API_KEY optional (mock extractor otherwise)
npm run seed                 # Northside Food Bank: 3 appeals, 20 donations, 8 receipts
npm run dev                  # http://localhost:3000
npm test                     # unit tests
npm run test:int -- http://127.0.0.1:PORT http://127.0.0.1:CDP  # live sandbox T4/T5/T7/T8/T9/T10 (fresh seed, running server)
URL=http://127.0.0.1:PORT OUT=../shots-m2 TRACE_ID=2 npm run test:e2e  # pages x 2 viewports, console, axe, watermark
```

## Demo logins (password `glasshouse-demo`)

| Role | Email |
|---|---|
| Donor | donor@northside.test |
| Volunteer | volunteer@northside.test |
| Trustee | trustee@northside.test |

The public ledger at `/` needs no login. Licence: MIT.
