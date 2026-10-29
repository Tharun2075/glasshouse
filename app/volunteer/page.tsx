import { redirect } from "next/navigation";
import { appeals } from "@/lib/ledger.ts";
import { currentUser } from "@/lib/session.ts";
import { ScanLine, ShieldCheck, UserCheck } from "lucide-react";
import UploadForm from "@/components/UploadForm";
export const dynamic = "force-dynamic";
export default async function Volunteer() {
  const u = await currentUser();
  if (!u || u.role !== "volunteer") redirect("/login");
  return (<section data-track-section="volunteer">
    <div className="hero rise"><p className="eyebrow">Volunteer · upload a receipt</p><h1>Prove the <em>spend</em>.</h1>
    <p className="lede">Claude reads the receipt and fills in the details (without an AI key, a demo reader is used and the spend says so). Nothing is paid automatically: every spend waits for a trustee.</p></div>
    <div className="split rise d1">
    <UploadForm appeals={appeals().map((a) => ({ id: a.id, title: a.title }))} />
    <div>
    <ol className="steps vertical" aria-label="What happens after upload">
      <li><strong><ScanLine className="icon" aria-hidden size={16} /> Read</strong><span>vendor, date, total and line items</span></li>
      <li><strong><ShieldCheck className="icon" aria-hidden size={16} /> Check</strong><span>risky or mismatched spends are held with a reason</span></li>
      <li><strong><UserCheck className="icon" aria-hidden size={16} /> Approve</strong><span>a trustee decides; only then PayPal pays</span></li>
    </ol>
    <p className="note">Receipts are public on the ledger. Cover any personal data (card numbers, home addresses) before you upload.</p>
    </div></div>
  </section>);
}
