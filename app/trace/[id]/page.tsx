import { notFound } from "next/navigation";
import { trace } from "@/lib/ledger.ts";
import { fmt } from "@/lib/money.ts";
import CopyLink from "@/components/CopyLink.tsx";
export const dynamic = "force-dynamic";
export default async function Trace({ params }: { params: Promise<{ id: string }> }) {
  const t = trace(Number((await params).id));
  if (!t) notFound();
  return (<>
    <h1>Where did your ${fmt(t.donation.amount_cents)} go?</h1>
    <p className="lede">Donation #{t.donation.id} from {t.donation.donor_name} to <strong>{t.appeal.title}</strong>. Gifts are spent oldest-first, so each dollar is matched to the receipts below.</p>
    <div className="cta-row" style={{ marginTop: 0, alignItems: "center" }}><CopyLink /><span className="muted">Anyone with this link sees the same receipts. No login needed.</span></div>
    {t.rows.map((r, i) => (
      <div className="trace-row" key={i}>
        {r.receipt ? <a href={r.receipt}><img src={r.receipt} alt={`Receipt from ${r.vendor}, ${r.date}`} width={240} height={320} /></a> : <div className="muted">No receipt yet</div>}
        <div>
          <div className="big mono">${fmt(r.cents)}</div>
          <div>{r.vendor ? <>{r.vendor} · {r.date} · <span className={`pill ${r.status}`}>{r.status}</span></> : "Not yet spent — held for this appeal"}</div>
          {r.status === "paid" && r.payout_status === "IMPORTED" && <p className="muted">Paid outside Glasshouse before go-live; the receipt is the proof.</p>}
          {r.status === "paid" && r.payout_status === "SUCCESS" && r.payout_batch && <p className="muted">paid = PayPal payout batch <span className="mono">{r.payout_batch}</span> succeeded.</p>}
          {r.status === "approved" && <p className="muted">approved = a trustee checked this receipt; the PayPal payout is on its way.</p>}
        </div>
      </div>))}
    <p data-testid="trace-total"><strong>Total traced: <span className="mono">${fmt(t.total_cents)}</span></strong> of ${fmt(t.donation.amount_cents)}</p>
  </>);
}
