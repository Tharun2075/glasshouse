import { redirect } from "next/navigation";
import { appeals } from "@/lib/ledger.ts";
import { currentUser } from "@/lib/session.ts";
import UploadForm from "@/components/UploadForm";
export const dynamic = "force-dynamic";
export default async function Volunteer() {
  const u = await currentUser();
  if (!u || u.role !== "volunteer") redirect("/login");
  return (<section>
    <h1>Upload a receipt</h1>
    <p className="muted">Claude reads the receipt and fills in the details (without an AI key, a demo reader is used and the spend says so). Nothing is paid automatically: every spend waits for a trustee.</p>
    <p className="note">Receipts are public on the ledger. Cover any personal data (card numbers, home addresses) before you upload.</p>
    <UploadForm appeals={appeals().map((a) => ({ id: a.id, title: a.title }))} />
  </section>);
}
