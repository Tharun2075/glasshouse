import { notFound } from "next/navigation";
import { BadgeCheck, CircleCheck, Clock, FileQuestion, HandCoins, Heart, ShieldAlert } from "lucide-react";
import { trace } from "@/lib/ledger.ts";
import { fmt } from "@/lib/money.ts";
import CopyLink from "@/components/CopyLink.tsx";
import StatusChip from "@/components/StatusChip.tsx";
export const dynamic = "force-dynamic";
// One timeline per gift: the donation, then each receipt it paid for (oldest-first), then the traced total.
const NODE: Record<string, typeof Clock> = { approved: CircleCheck, paid: BadgeCheck, held: ShieldAlert };
export default async function Trace({ params }: { params: Promise<{ id: string }> }) {
  const t = trace(Number((await params).id));
  if (!t) notFound();
  return (<>
    <section className="hero trace-hero rise">
      <h1>Where did your <em>${fmt(t.donation.amount_cents)}</em> go?</h1>
      <p className="lede">Donation #{t.donation.id} from {t.donation.donor_name} to <strong>{t.appeal.title}</strong>. Gifts are spent oldest-first, so each dollar is matched to the receipts below.</p>
      <div className="cta-row"><CopyLink /><span className="muted">Anyone with this link sees the same receipts. No login needed.</span></div>
    </section>
    <ol className="timeline" aria-label="Path of this gift">
      <li className="rise d1">
        <span className="node" aria-hidden><Heart className="icon" size={22} /></span>
        <div className="step"><span className="k">Gift received</span><h2 className="h3">{t.donation.donor_name} gave <span className="mono">${fmt(t.donation.amount_cents)}</span></h2>
          <p className="muted">To {t.appeal.title}.</p></div>
      </li>
      {t.rows.map((r, i) => {
        const Icon = (r.status && NODE[r.status]) || (r.vendor ? Clock : HandCoins);
        return (<li key={i} className="rise d2">
          <span className={`node ${r.status ?? ""}`} aria-hidden><Icon className="icon" size={22} /></span>
          <div className="step">
            <span className="k">{r.vendor ? `Spent on ${r.date}` : "Still in the appeal"}</span>
            <div className="trace-row">
              {r.receipt ? <a href={r.receipt}><img src={r.receipt} alt={`Receipt from ${r.vendor}, ${r.date}`} width={240} height={320} /></a>
                : <div className="noreceipt"><FileQuestion className="icon" aria-hidden size={28} />No receipt yet</div>}
              <div>
                <div className="big mono">${fmt(r.cents)}</div>
                <div className="line">{r.vendor ? <><strong>{r.vendor}</strong><span className="muted">{r.date}</span>{r.status && <StatusChip status={r.status} />}</> : "Not yet spent — held for this appeal"}</div>
                {r.status === "paid" && r.payout_status === "IMPORTED" && <p className="muted">Paid outside Glasshouse before go-live; the receipt is the proof.</p>}
                {r.status === "paid" && r.payout_status === "SUCCESS" && r.payout_batch && <p className="muted">paid = PayPal payout batch <span className="mono">{r.payout_batch}</span> succeeded.</p>}
                {r.status === "approved" && <p className="muted">approved = a trustee checked this receipt; the PayPal payout is on its way.</p>}
              </div>
            </div>
          </div>
        </li>);
      })}
    </ol>
    <div className="total rise d3" data-testid="trace-total"><p><strong>Total traced: <span className="mono">${fmt(t.total_cents)}</span></strong> of ${fmt(t.donation.amount_cents)}</p></div>
  </>);
}
