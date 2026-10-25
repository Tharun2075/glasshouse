"use client";
import { useState } from "react";
type P = { batch_id: string | null; status: string } | null;
export default function SpendActions({ id, status, payout }: { id: number; status: string; payout: P }) {
  const [p, setP] = useState<P>(payout), [st, setSt] = useState(status), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function call(url: string) {
    setBusy(true); setErr("");
    const r = await fetch(url, { method: "POST" }); const b = await r.json(); setBusy(false);
    if (!r.ok) { setErr(b.error ?? `HTTP ${r.status}`); return; }
    if (b.payout) { setP({ batch_id: b.payout.batch_id, status: b.payout.status }); if (st === "pending") setSt("approved"); if (b.payout.status === "SUCCESS") setSt("paid"); }
  }
  if (st === "held") return <span className="muted">No payout</span>;
  return (<div style={{ display: "grid", gap: 4 }}>
    {st === "pending" && <button disabled={busy} onClick={() => call(`/api/spends/${id}/approve`)}>Approve and pay</button>}
    {p && <span className="mono" data-testid={`batch-${id}`}>{p.status}{p.batch_id ? ` · ${p.batch_id}` : ""}</span>}
    {p?.batch_id && p.status !== "SUCCESS" && <button className="ghost" disabled={busy} onClick={() => call(`/api/payouts/${id}/poll`)}>Check payout</button>}
    {err && <span className="err" role="alert">{err}</span>}
  </div>);
}
