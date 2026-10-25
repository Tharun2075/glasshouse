import { notFound } from "next/navigation";
import { trace } from "@/lib/ledger.ts";
import { fmt } from "@/lib/money.ts";
export const dynamic = "force-dynamic";
export default async function Trace({ params }: { params: Promise<{ id: string }> }) {
  const t = trace(Number((await params).id));
  if (!t) notFound();
  return (<>
    <h1>Where did your ${fmt(t.donation.amount_cents)} go?</h1>
    <p className="lede">Donation #{t.donation.id} from {t.donation.donor_name} to <strong>{t.appeal.title}</strong>. Gifts are spent oldest-first, so each dollar is matched to the receipts below.</p>
    {t.rows.map((r, i) => (
      <div className="trace-row" key={i}>
        {r.receipt ? <a href={r.receipt}><img src={r.receipt} alt={`Receipt from ${r.vendor}, ${r.date}`} width={160} height={213} /></a> : <div className="muted">No receipt yet</div>}
        <div>
          <div className="big mono">${fmt(r.cents)}</div>
          <div>{r.vendor ? <>{r.vendor} · {r.date} · <span className={`pill ${r.status}`}>{r.status}</span></> : "Not yet spent — held for this appeal"}</div>
        </div>
      </div>))}
    <p data-testid="trace-total"><strong>Total traced: <span className="mono">${fmt(t.total_cents)}</span></strong> of ${fmt(t.donation.amount_cents)}</p>
  </>);
}
