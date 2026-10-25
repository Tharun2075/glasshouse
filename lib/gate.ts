// Trustee approval gate: the only path to a payout. No approval row => 403, no batch.
export type GateSpend = { id: number; status: string; amount_cents?: number };
export type GateResult = { ok: true } | { ok: false; status: 403 | 409; error: string };

export function payoutGate(spend: GateSpend | undefined, approvals: number): GateResult {
  if (!spend) return { ok: false, status: 403, error: "unknown spend" };
  if (spend.status === "held") return { ok: false, status: 403, error: "spend is held; held spends are never paid" };
  if (spend.amount_cents != null && spend.amount_cents <= 0) return { ok: false, status: 403, error: "spend has no readable amount; it can never be paid" };
  if (spend.status === "rejected") return { ok: false, status: 403, error: "spend was rejected" };
  if (approvals < 1 || spend.status === "pending") return { ok: false, status: 403, error: "trustee approval required" };
  return { ok: true };
}
