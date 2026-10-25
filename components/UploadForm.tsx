"use client";
import { useState } from "react";
type Res = { spend?: { id: number; status: string; hold_reason: string | null; flags: string }; extraction?: Record<string, unknown>; extracted_by?: string; error?: string };
export default function UploadForm({ appeals }: { appeals: { id: number; title: string }[] }) {
  const [res, setRes] = useState<Res | null>(null), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setRes(null);
    const r = await fetch("/api/receipts", { method: "POST", body: new FormData(e.currentTarget) });
    setRes(await r.json()); setBusy(false);
  }
  return (<div>
    <form onSubmit={submit} className="card" style={{ display: "grid", gap: 12, maxWidth: 480 }}>
      <label htmlFor="appeal_id">Appeal</label>
      <select id="appeal_id" name="appeal_id">{appeals.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
      <label htmlFor="receipt">Receipt image (PNG, under 5 MB)</label>
      <input id="receipt" name="receipt" type="file" accept="image/png" required />
      <button type="submit" disabled={busy}>{busy ? "Reading receipt…" : "Upload and read"}</button>
    </form>
    {res?.error && <p className="err" role="alert">{res.error}</p>}
    {res?.spend && (<div className="card" role="status" style={{ marginTop: 16 }}>
      <p>Spend #{res.spend.id} saved as <span className={`pill ${res.spend.status}`}>{res.spend.status}</span> (read by {res.extracted_by}).</p>
      {res.spend.hold_reason && <p className="err">{res.spend.hold_reason}</p>}
      <pre className="mono" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(res.extraction, null, 2)}</pre>
    </div>)}
  </div>);
}
