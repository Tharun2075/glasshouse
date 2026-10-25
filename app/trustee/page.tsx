import { redirect } from "next/navigation";
import { CircleCheck, Clock, FileText, Inbox, ShieldAlert, TriangleAlert } from "lucide-react";
import { ledger, mismatches } from "@/lib/ledger.ts";
import { currentUser } from "@/lib/session.ts";
import { usd } from "@/lib/money.ts";
import SpendActions from "@/components/SpendActions";
import StatusChip from "@/components/StatusChip.tsx";
export const dynamic = "force-dynamic";
// Three queues, most urgent first: needs you (pending), held by AI (with the reason), done. Below 640px each table restyles
// into one card per spend (CSS only, same markup), so the hold reason and the full-width Approve button are on screen
// without sideways scrolling (D2).
const ORDER: Record<string, number> = { pending: 0, held: 1, approved: 2, paid: 3, rejected: 4 };
type Spend = ReturnType<typeof ledger>["spends"][number];
export default async function Trustee() {
  const u = await currentUser();
  if (!u || u.role !== "trustee") redirect("/login");
  const l = ledger(), mm = mismatches();
  const title = (id: number) => l.appeals.find((a) => a.id === id)?.title ?? "";
  const rows = [...l.spends].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || b.id - a.id);
  const pending = rows.filter((s) => s.status === "pending"), held = rows.filter((s) => s.status === "held"),
    done = rows.filter((s) => s.status !== "pending" && s.status !== "held");
  const sum = (xs: Spend[]) => usd(xs.reduce((a, s) => a + s.amount_cents, 0));
  const table = (xs: Spend[], why: boolean) => (<table className="plain cardtable">
    <thead><tr><th>#</th><th>Appeal</th><th>Vendor</th><th className="r">Amount</th><th>Status</th>{why && <th>Why held</th>}<th>Read by</th><th>Receipt</th><th>Action</th></tr></thead>
    <tbody>{xs.map((s) => (<tr key={s.id} className={s.status === "held" ? "row-held" : undefined} data-testid={`spend-${s.id}`}>
      <td data-label="#" className="mono">{s.id}</td><td data-label="Appeal">{title(s.appeal_id)}</td><td data-label="Vendor" className="c-vendor">{s.vendor}</td>
      <td data-label="Amount" className="mono c-amount">{usd(s.amount_cents)}</td>
      <td data-label="Status"><StatusChip status={s.status} /></td>
      {why && <td data-label="Why held" className={s.hold_reason ? "c-reason" : "c-empty"}>{s.hold_reason ? <span className="reason"><ShieldAlert className="icon" aria-hidden size={16} />{s.hold_reason}</span> : ""}</td>}
      <td data-label="Read by" className="reader">{s.extracted_by === "claude" ? "Claude" : "Demo reader (no AI key)"}</td>
      <td data-label="Receipt"><a className="receipt-link" href={`/api/receipts/${s.id}`} target="_blank" rel="noreferrer"><FileText className="icon" aria-hidden size={16} />View receipt {s.id}</a></td>
      <td data-label="Action" className="c-action"><SpendActions id={s.id} status={s.status} payout={s.payout ? { batch_id: s.payout.batch_id, status: s.payout.status } : null} /></td>
    </tr>))}</tbody>
  </table>);
  return (<section>
    <div className="hero rise"><h1>Approvals</h1>
      <p className="lede">Approving a spend sends exactly one PayPal sandbox payout. Held spends cannot be paid.</p></div>
    <ul className="stats rise d1">
      <li><span className="k"><Clock className="icon" aria-hidden size={14} />Needs you</span><span className="v">{pending.length}</span></li>
      <li><span className="k"><ShieldAlert className="icon" aria-hidden size={14} />Held by AI</span><span className="v held">{held.length}</span></li>
      <li><span className="k"><CircleCheck className="icon" aria-hidden size={14} />Done</span><span className="v approved">{done.length}</span></li>
      <li><span className="k"><TriangleAlert className="icon" aria-hidden size={14} />To reconcile</span><span className="v">{mm.length}</span></li>
    </ul>
    {mm.length > 0 && <div className="note" role="alert"><strong>Donations to reconcile:</strong> PayPal captured a different amount than the donor chose.
      <ul>{mm.map((d) => <li key={d.id} className="mono">#{d.id} {d.donor_name}: expected {usd(d.amount_cents)}, captured {d.captured_value} (capture {d.capture_id})</li>)}</ul></div>}
    <div className="queue rise d2">
      <div className="section-head"><h2>Needs your decision <span className="count">{pending.length}</span></h2><p>{sum(pending)} waiting</p></div>
      {pending.length ? table(pending, false) : <div className="empty"><Inbox className="icon" aria-hidden size={28} /><div><strong>Nothing to approve</strong>New receipts from volunteers appear here.</div></div>}
    </div>
    <div className="queue held rise d2">
      <div className="section-head"><h2>Held by AI — cannot be paid <span className="count">{held.length}</span></h2><p>The receipt reader found a problem; the reason is shown on each spend.</p></div>
      {held.length ? table(held, true) : <div className="empty"><ShieldAlert className="icon" aria-hidden size={28} /><div><strong>No held spends</strong>Every receipt matched its appeal and limits.</div></div>}
    </div>
    <div className="queue rise d3">
      <div className="section-head"><h2>Done <span className="count">{done.length}</span></h2><p>{sum(done)} decided</p></div>
      {done.length ? table(done, false) : <div className="empty"><CircleCheck className="icon" aria-hidden size={28} /><div><strong>No decisions yet</strong>Approved and paid spends are listed here.</div></div>}
    </div>
    <p className="note">Payout proof: each approved spend shows its PayPal batch id and status (sandbox receiver accounts do not expose a balance report).</p>
  </section>);
}
