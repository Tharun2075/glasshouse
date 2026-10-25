import { appeals } from "@/lib/ledger.ts";
import { currentUser } from "@/lib/session.ts";
import DonateForm from "@/components/DonateForm.tsx";
export const dynamic = "force-dynamic";
export default async function Donate({ searchParams }: { searchParams: Promise<{ cancelled?: string; error?: string }> }) {
  const sp = await searchParams, u = await currentUser();
  return (<>
    <div className="hero rise"><h1>Give to <em>Northside Food Bank</em></h1>
    <p className="lede">You pay through PayPal (sandbox). Afterwards you get a link showing exactly which receipts your gift paid for.</p></div>
    <ol className="steps" aria-label="What happens next">
      <li><strong>Pay</strong><span>with PayPal (sandbox)</span></li>
      <li><strong>Get your trace link</strong><span>shown right after paying</span></li>
      <li><strong>See the receipts</strong><span>your dollars paid for, as they come in</span></li>
    </ol>
    {sp.cancelled && <p className="note" role="status">Payment cancelled. Nothing was charged.</p>}
    {sp.error && <p className="note err" role="alert">{sp.error}</p>}
    <div className="panel rise d1"><DonateForm appeals={appeals()} donorName={u?.name ?? "Anonymous"} /></div>
  </>);
}
