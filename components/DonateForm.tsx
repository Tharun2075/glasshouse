"use client";
import { useState } from "react";
import type { Appeal } from "@/lib/ledger.ts";
export default function DonateForm({ appeals, donorName }: { appeals: Appeal[]; donorName: string }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function go(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr("");
    const f = new FormData(e.currentTarget);
    const r = await fetch("/api/donate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appeal_id: Number(f.get("appeal")), amount: String(f.get("amount")) }) });
    const b = await r.json();
    if (r.ok && b.approve) window.location.href = b.approve; else { setErr(b.error ?? "Could not start payment"); setBusy(false); }
  }
  return (<form className="stack" onSubmit={go}>
    <label htmlFor="appeal">Appeal</label>
    <select id="appeal" name="appeal">{appeals.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
    <label htmlFor="amount">Amount (USD)</label>
    <input id="amount" name="amount" inputMode="decimal" defaultValue="25.00" required pattern="\d+(\.\d{1,2})?" />
    <p className="muted">Giving as {donorName}.</p>
    {err && <p className="note err" role="alert">{err}</p>}
    <p><button type="submit" disabled={busy}>{busy ? "Opening PayPal…" : "Donate with PayPal"}</button></p>
  </form>);
}
