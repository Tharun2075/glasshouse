import { redirect } from "next/navigation";
import { ledger } from "@/lib/ledger.ts";
import { currentUser } from "@/lib/session.ts";
import { usd } from "@/lib/money.ts";
import SpendActions from "@/components/SpendActions";
export const dynamic = "force-dynamic";
export default async function Trustee() {
  const u = await currentUser();
  if (!u || u.role !== "trustee") redirect("/login");
  const l = ledger();
  const title = (id: number) => l.appeals.find((a) => a.id === id)?.title ?? "";
  return (<section>
    <h1>Approvals</h1>
    <p className="muted">Approving a spend sends exactly one PayPal sandbox payout. Held spends cannot be paid.</p>
    <p className="note">Receiver balance proof: blocked. The sandbox receiver is a GBP account and PayPal answers 403 on the balances report, so we show the payout batch status instead.</p>
    <div style={{ overflowX: "auto" }}><table className="plain">
      <thead><tr><th>#</th><th>Appeal</th><th>Vendor</th><th>Amount</th><th>Status</th><th>Why held</th><th>Receipt</th><th>Action</th></tr></thead>
      <tbody>{l.spends.map((s) => (<tr key={s.id} className={s.status === "held" ? "row-held" : undefined}>
        <td>{s.id}</td><td>{title(s.appeal_id)}</td><td>{s.vendor}</td><td className="mono">{usd(s.amount_cents)}</td>
        <td><span className={`pill ${s.status}`}>{s.status}</span></td><td>{s.hold_reason ?? ""}</td>
        <td><a href={`/api/receipts/${s.id}`} target="_blank" rel="noreferrer">View</a></td>
        <td><SpendActions id={s.id} status={s.status} payout={s.payout ? { batch_id: s.payout.batch_id, status: s.payout.status } : null} /></td>
      </tr>))}</tbody>
    </table></div>
  </section>);
}
