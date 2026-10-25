// Seed the Northside Food Bank demo: 3 appeals, 21 demo donations (source 'seed'), 8 fixture receipts, 3 logins.
// Run: npm run seed  (wipes data/glasshouse.db first). Receipt PNGs come from scripts/gen_receipts.py.
import { rmSync, readFileSync } from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../lib/db.ts";

const dbFile = process.env.GH_DB ?? path.join(DATA_DIR, "glasshouse.db");
for (const s of ["", "-wal", "-shm"]) rmSync(dbFile + s, { force: true });

const { run, one } = await import("../lib/db.ts");
const { hashPw } = await import("../lib/auth.ts");
const { addSpend } = await import("../lib/ledger.ts");

export const DEMO_PASSWORD = "glasshouse-demo";
run("INSERT INTO orgs(id,name) VALUES(1,'Northside Food Bank')");
const users = [["donor@northside.test", "Dana Donor", "donor"], ["volunteer@northside.test", "Vik Volunteer", "volunteer"], ["trustee@northside.test", "Tess Trustee", "trustee"]];
for (const [email, name, role] of users) run("INSERT INTO users(email,name,role,pw) VALUES(?,?,?,?)", email, name, role, hashPw(DEMO_PASSWORD));
const uid = (role: string) => one<{ id: number }>("SELECT id FROM users WHERE role=?", role)!.id;

run("INSERT INTO appeals(id,org_id,title,goal_cents,item_cap_cents) VALUES(1,1,'Winter Food Parcels',300000,50000),(2,1,'Kitchen Equipment',150000,40000),(3,1,'Delivery Van Fuel',60000,15000)");

// [appeal, donor name, dollars, date]; the demo donor's $25 is the 2nd gift to appeal 1 (FIFO: $20 -> receipt 1, $5 -> receipt 2)
const dons: [number, string, number, string][] = [
  [1, "Anonymous", 20, "2026-09-01"], [1, "Dana Donor", 25, "2026-09-02"], [1, "R. Okafor", 50, "2026-09-03"], [1, "Anonymous", 15, "2026-09-05"],
  [1, "M. Lindqvist", 40, "2026-09-09"], [1, "Anonymous", 30, "2026-09-12"], [1, "J. Patel", 60, "2026-09-18"], [1, "Anonymous", 25, "2026-09-26"],
  [1, "S. Moreau", 100, "2026-10-03"], [1, "Anonymous", 10, "2026-10-14"],
  [2, "Hollis Family", 75, "2026-09-04"], [2, "Anonymous", 50, "2026-09-11"], [2, "T. Nguyen", 40, "2026-09-20"], [2, "Anonymous", 35, "2026-10-02"],
  [2, "K. Brennan", 120, "2026-10-09"], [2, "Northside Rotary", 150, "2026-10-10"], [2, "Anonymous", 20, "2026-10-16"],
  [3, "Anonymous", 15, "2026-09-06"], [3, "P. Adeyemi", 20, "2026-09-24"], [3, "Anonymous", 10, "2026-10-05"], [3, "L. Rossi", 25, "2026-10-11"],
];
dons.forEach(([a, name, usd, date], i) => {
  const t = `${date}T10:${String(i).padStart(2, "0")}:00.000Z`;
  run(`INSERT INTO donations(appeal_id,donor_id,donor_name,amount_cents,order_id,capture_id,status,source,created_at,captured_at) VALUES(?,?,?,?,?,?,'COMPLETED','seed',?,?)`,
    a, name === "Dana Donor" ? uid("donor") : null, name, usd * 100, `SEED-${i + 1}`, `SEED-CAP-${i + 1}`, t, t);
});

// receipts in date order. r1-r5 were reimbursed before Glasshouse existed: seeded as 'paid' with an "imported" payout row
// (no PayPal batch), so the trustee page never offers to pay them again (D6). r6 dup, r7 anomaly -> held; r8 stays pending
// so a trustee sees a live Approve button (T8). Every appeal keeps spent <= raised (D5).
const recs = JSON.parse(readFileSync(path.join(DATA_DIR, "fixtures", "seed-receipts.json"), "utf8"));
const approve = new Set(["r1.png", "r2.png", "r3.png", "r4.png", "r5.png"]);
for (const r of recs) {
  const s = addSpend(r.appeal_id, r.extraction, "mock", r.file, r.hash, uid("volunteer"), `${r.extraction.date}T16:00:00.000Z`);
  if (approve.has(r.file)) {
    if (s.status !== "pending") throw new Error(`seed: ${r.file} expected pending, got ${s.status}`);
    run("INSERT INTO approvals(spend_id,trustee_id,created_at) VALUES(?,?,?)", s.id, uid("trustee"), `${r.extraction.date}T18:00:00.000Z`);
    run("UPDATE spends SET status='paid' WHERE id=?", s.id);
    run("INSERT INTO payouts(spend_id,sender_batch_id,batch_id,status,item_status,created_at,updated_at) VALUES(?,?,NULL,'IMPORTED',?,?,?)",
      s.id, `imported-${s.id}`, "paid outside Glasshouse (before go-live)", `${r.extraction.date}T18:00:00.000Z`, `${r.extraction.date}T18:00:00.000Z`);
  }
  console.log(`${r.file} -> spend #${s.id} ${(s.amount_cents / 100).toFixed(2)} ${approve.has(r.file) ? "paid (imported)" : s.status}${s.hold_reason ? " :: " + s.hold_reason : ""}`);
}
for (const a of [1, 2, 3]) {
  const raised = one<{ c: number }>("SELECT sum(amount_cents) c FROM donations WHERE appeal_id=?", a)!.c;
  const spent = one<{ c: number }>("SELECT coalesce(sum(amount_cents),0) c FROM spends WHERE appeal_id=? AND status IN ('approved','paid','pending')", a)!.c;
  if (spent > raised) throw new Error(`seed: appeal ${a} would spend ${spent} > raised ${raised}`);
}
console.log("seeded:", one<{ n: number }>("SELECT count(*) n FROM donations")!.n, "donations");
