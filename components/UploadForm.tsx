"use client";
import { ShieldAlert } from "lucide-react";
import StatusChip from "./StatusChip.tsx";
import { useState } from "react";
type Res = { spend?: { id: number; status: string; hold_reason: string | null; flags: string }; extraction?: Record<string, unknown>; extracted_by?: string; limit_note?: string; error?: string };
export default function UploadForm({ appeals }: { appeals: { id: number; title: string }[] }) {
  const [res, setRes] = useState<Res | null>(null), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setRes(null);
    const r = await fetch("/api/receipts", { method: "POST", body: new FormData(e.currentTarget) });
    setRes(await r.json()); setBusy(false);
  }
  return (<div>
    <form onSubmit={submit} className="panel stack">
      <label htmlFor="appeal_id">Appeal</label>
      <select id="appeal_id" name="appeal_id">{appeals.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
      <p className="muted tight">No receipt handy? <a href="/sample-receipt.png" download="sample-receipt.png">Download a sample receipt to try</a>, then pick it below.</p>
      <label htmlFor="receipt">Receipt image (PNG, under 5 MB)</label>
      <input id="receipt" name="receipt" type="file" accept="image/png" required />
      <button type="submit" disabled={busy} data-track="submit-receipt">{busy ? "Reading receipt…" : "Upload and read"}</button>
    </form>
    {res?.error && <p className="err" role="alert">{res.error}</p>}
    {res?.spend && (<div className="panel result rise" role="status">
      <p>Spend #{res.spend.id} saved as <StatusChip status={res.spend.status} /> (read by {res.extracted_by}).</p>
      {res.limit_note && <p className="note" role="status">{res.limit_note}</p>}
      {res.spend.hold_reason && <p className="c-reason"><span className="reason"><ShieldAlert className="icon" aria-hidden size={16} />{res.spend.hold_reason}</span></p>}
      <pre className="mono wrap">{JSON.stringify(res.extraction, null, 2)}</pre>
    </div>)}
  </div>);
}
