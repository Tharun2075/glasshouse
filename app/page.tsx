import { ledger } from "@/lib/ledger.ts";
import { fmt } from "@/lib/money.ts";
import LedgerGrid from "@/components/LedgerGrid.tsx";
export const dynamic = "force-dynamic";

export default function Home() {
  const l = ledger();
  return (<>
    <h1>Northside Food Bank — public ledger</h1>
    <p className="lede">Every donation and every spend, with the receipt behind it. Held items are shown in red and are never paid until a trustee clears them. Sandbox data only.</p>
    <div className="cards">
      {l.appeals.map((a) => (
        <div className="card" key={a.id}>
          <div className="muted">{a.title}</div>
          <div className="big">${fmt(a.raised_cents)} raised</div>
          <div className="muted">${fmt(a.spent_cents)} spent · goal ${fmt(a.goal_cents)}</div>
          <div className="bar" role="img" aria-label={`${Math.round((100 * a.raised_cents) / a.goal_cents)}% of goal`}><span style={{ width: `${Math.min(100, (100 * a.raised_cents) / a.goal_cents)}%` }} /></div>
        </div>))}
    </div>
    <h2>Spends by appeal</h2>
    <LedgerGrid data={l} />
    <h2>Recent donations</h2>
    <table className="plain"><thead><tr><th>Donor</th><th>Appeal</th><th>Amount</th><th>Where it went</th></tr></thead><tbody>
      {l.donations.slice(-8).reverse().map((d) => (<tr key={d.id}><td>{d.donor_name}</td><td>{l.appeals.find((a) => a.id === d.appeal_id)?.title}</td><td className="mono">${fmt(d.amount_cents)}</td><td><a href={`/trace/${d.id}`}>Trace donation #{d.id}</a></td></tr>))}
    </tbody></table>
  </>);
}
