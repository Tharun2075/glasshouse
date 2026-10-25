import { redirect } from "next/navigation";
import { ledger, mismatches } from "@/lib/ledger.ts";
import { currentUser } from "@/lib/session.ts";
import { usd } from "@/lib/money.ts";
import SpendActions from "@/components/SpendActions";
export const dynamic = "force-dynamic";
// Spends needing a decision come first. Below 640px the table restyles into one card per spend (CSS only, same markup),
// so the hold reason and the full-width Approve button are on screen without sideways scrolling (D2).
const ORDER: Record<string, number> = { pending: 0, held: 1, approved: 2, paid: 3, rejected: 4 };
export default async function Trustee() {
  const u = await currentUser();
  if (!u || u.role !== "trustee") redirect("/login");
  const l = ledger(), mm = mismatches();
  const title = (id: number) => l.appeals.find((a) => a.id === id)?.title ?? "";
  const rows = [...l.spends].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || b.id - a.id);
  return (<section>
    <h1>Approvals</h1>
    <p className="muted">Approving a spend sends exactly one PayPal sandbox payout. Held spends cannot be paid.</p>
    {mm.length > 0 && <div className="note" role="alert"><strong>Donations to reconcile:</strong> PayPal captured a different amount than the donor chose.
      <ul>{mm.map((d) => <li key={d.id} className="mono">#{d.id} {d.donor_name}: expected {usd(d.amount_cents)}, captured {d.captured_value} (capture {d.capture_id})</li>)}</ul></div>}
    <table className="plain cardtable">
      <thead><tr><th>#</th><th>Appeal</th><th>Vendor</th><th>Amount</th><th>Status</th><th>Why held</th><th>Read by</th><th>Receipt</th><th>Action</th></tr></thead>
      <tbody>{rows.map((s) => (<tr key={s.id} className={s.status === "held" ? "row-held" : undefined} data-testid={`spend-${s.id}`}>
        <td data-label="#">{s.id}</td><td data-label="Appeal">{title(s.appeal_id)}</td><td data-label="Vendor" className="c-vendor">{s.vendor}</td>
        <td data-label="Amount" className="mono c-amount">{usd(s.amount_cents)}</td>
        <td data-label="Status"><span className={`pill ${s.status}`}>{s.status}</span></td>
        <td data-label="Why held" className={s.hold_reason ? "c-reason" : "c-empty"}>{s.hold_reason ?? ""}</td>
        <td data-label="Read by">{s.extracted_by === "claude" ? "Claude" : "Demo reader (no AI key)"}</td>
        <td data-label="Receipt"><a href={`/api/receipts/${s.id}`} target="_blank" rel="noreferrer">View receipt {s.id}</a></td>
        <td data-label="Action" className="c-action"><SpendActions id={s.id} status={s.status} payout={s.payout ? { batch_id: s.payout.batch_id, status: s.payout.status } : null} /></td>
      </tr>))}</tbody>
    </table>
    <p className="note">Payout proof: each approved spend shows its PayPal batch id and status (sandbox receiver accounts do not expose a balance report).</p>
  </section>);
}
