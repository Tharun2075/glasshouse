import { ArrowRight, Gift, Receipt, ScanSearch, Search, Send, ShieldAlert, UserCheck, Wallet, Landmark, HeartHandshake } from "lucide-react";
import { ledger } from "@/lib/ledger.ts";
import { fmt } from "@/lib/money.ts";
import LedgerGrid from "@/components/LedgerGrid.tsx";
import AppealIcon from "@/components/AppealIcon.tsx";
export const dynamic = "force-dynamic";

const pct = (n: number, d: number) => (d > 0 ? Math.min(100, (100 * n) / d) : 0);
const sum = (xs: { amount_cents: number }[]) => xs.reduce((a, x) => a + x.amount_cents, 0);

export default function Home() {
  const l = ledger();
  const raised = sum(l.donations);
  const spent = l.appeals.reduce((a, x) => a + x.spent_cents, 0);
  const held = l.spends.filter((s) => s.status === "held");
  const paid = l.spends.filter((s) => s.status === "paid");
  const example = held.find((s) => s.hold_reason);
  return (<>
    <section className="hero">
      <div className="rise">
        <h1>Northside Food Bank — <em>public ledger</em></h1>
        <p className="lede">Every donation and every spend, with the receipt behind it. Held items are shown in amber and are never paid until a trustee clears them. Sandbox data only.</p>
        <div className="cta-row">
          <a className="btn lg" href="/donate"><HeartHandshake className="icon" aria-hidden size={20} />Donate to an appeal</a>
          <form action="/trace" method="get" className="trace-form">
            <label htmlFor="gift">Trace your gift</label>
            <input id="gift" name="id" inputMode="numeric" pattern="[0-9]+" placeholder="Donation number, e.g. 12" required />
            <button type="submit" className="ghost"><Search className="icon" aria-hidden size={16} />Trace</button>
          </form>
        </div>
      </div>
      <ol className="flow rise d1" aria-label="How a dollar moves">
        <li><span className="dot"><Gift className="icon" aria-hidden /></span><div><strong>You give</strong><span>Paid through PayPal, logged here the same second.</span></div></li>
        <li><span className="dot"><Receipt className="icon" aria-hidden /></span><div><strong>A volunteer uploads the receipt</strong><span>The photo is public; card numbers never are.</span></div></li>
        <li><span className="dot held"><ScanSearch className="icon" aria-hidden /></span><div><strong>AI reads it and flags risky spend</strong><span>Duplicates, over-cap items and odd amounts are held.</span>
          {example && <span className="why-line">Live example: {example.vendor} — {example.hold_reason!.replace(/^Held:\s*/, "")}</span>}</div></li>
        <li><span className="dot approved"><UserCheck className="icon" aria-hidden /></span><div><strong>A trustee approves</strong><span>Nothing is paid on the AI’s word alone.</span></div></li>
        <li><span className="dot paid"><Send className="icon" aria-hidden /></span><div><strong>PayPal pays the supplier</strong><span>The payout id lands on the same row.</span></div></li>
      </ol>
    </section>

    <ul className="stats rise d2" aria-label="Totals">
      <li><span className="k"><Wallet className="icon" aria-hidden size={16} />Raised</span><span className="v num">${fmt(raised)}</span></li>
      <li><span className="k"><Receipt className="icon" aria-hidden size={16} />Spent, with receipts</span><span className="v num approved">${fmt(spent)}</span></li>
      <li><span className="k"><ShieldAlert className="icon" aria-hidden size={16} />Held by AI</span><span className="v num held">{held.length} · ${fmt(sum(held))}</span></li>
      <li><span className="k"><Landmark className="icon" aria-hidden size={16} />Paid via PayPal</span><span className="v num paid">{paid.length} · ${fmt(sum(paid))}</span></li>
    </ul>

    <div className="section-head"><h2>Appeals</h2><p className="legend"><span><i />Raised</span><span><i className="spent" />Spent</span></p></div>
    <div className="cards">
      {l.appeals.map((a) => (
        <article className="card appeal" key={a.id}>
          <div className="head"><span className="badge"><AppealIcon title={a.title} /></span><h3>{a.title}</h3></div>
          <div className="raised num">${fmt(a.raised_cents)}<small>raised</small></div>
          <div className="bar" role="img" aria-label={`${Math.round(pct(a.raised_cents, a.goal_cents))}% of goal`}>
            <span style={{ width: `${pct(a.raised_cents, a.goal_cents)}%` }} />
            <span className="spent" style={{ width: `${pct(a.spent_cents, a.goal_cents)}%` }} />
          </div>
          <div className="meta"><span>${fmt(a.spent_cents)} spent</span><span>goal ${fmt(a.goal_cents)}</span></div>
        </article>))}
    </div>

    <div className="section-head" id="ledger"><h2>Spends by appeal</h2><p>Every receipt, its status, and why the AI held it.</p></div>
    <LedgerGrid data={l} />

    <div className="section-head"><h2>Recent donations</h2><p>Follow any gift to the receipts it paid for.</p></div>
    <ul className="rows">
      {l.donations.slice(-8).reverse().map((d) => (
        <li key={d.id}>
          <span className="avatar" aria-hidden>{d.donor_name.trim().charAt(0).toUpperCase() || "?"}</span>
          <span className="who-line"><strong>{d.donor_name}</strong><span>{l.appeals.find((a) => a.id === d.appeal_id)?.title}</span></span>
          <span className="amt num">${fmt(d.amount_cents)}</span>
          <a href={`/trace/${d.id}`}>Trace donation #{d.id}<ArrowRight className="icon" aria-hidden size={16} /></a>
        </li>))}
      {l.donations.length === 0 && <li className="empty"><Gift className="icon" aria-hidden /><strong>No donations yet.</strong> Be the first: every gift shows up here.</li>}
    </ul>
  </>);
}
