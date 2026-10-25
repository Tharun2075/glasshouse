"use client";
import { useState } from "react";
type P = { batch_id: string | null; status: string } | null;
const label = (p: NonNullable<P>) => p.status === "IMPORTED" ? "Paid outside Glasshouse (before go-live)" : `${p.status}${p.batch_id ? ` · ${p.batch_id}` : ""}`;
export default function SpendActions({ id, status, payout }: { id: number; status: string; payout: P }) {
  const [p, setP] = useState<P>(payout), [st, setSt] = useState(status), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function call(url: string, body?: unknown) {
    setBusy(true); setErr("");
    const r = await fetch(url, { method: "POST", ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
    const b = await r.json().catch(() => ({})); setBusy(false);
    if (b.payout) { setP({ batch_id: b.payout.batch_id, status: b.payout.status }); if (st === "pending") setSt("approved"); if (b.payout.status === "SUCCESS") setSt("paid"); }
    if (!r.ok) setErr(b.error ?? `HTTP ${r.status}`);
  }
  if (st === "held") return <span className="muted">No payout while held</span>;
  return (<div className="actions">
    {st === "pending" && <button disabled={busy} onClick={() => call(`/api/spends/${id}/approve`)}>Approve and pay</button>}
    {p && <span className={p.status === "IMPORTED" ? "muted" : "mono"} data-testid={`batch-${id}`}>{label(p)}</span>}
    {p?.batch_id && p.status !== "SUCCESS" && <button className="ghost" disabled={busy} onClick={() => call(`/api/payouts/${id}/poll`)}>Check payout</button>}
    {p && !p.batch_id && p.status.startsWith("ERROR") && <button className="ghost" disabled={busy} onClick={() => call("/api/payouts", { spend_id: id })}>Retry payout</button>}
    {err && <span className="err" role="alert">{err}</span>}
  </div>);
}
