// FIFO allocation: within an appeal, the oldest unspent donation cents fund the oldest approved spend.
// Pure and integer-cent only, so a donor trace always sums exactly to the donation.
export type Don = { id: number; appeal_id: number; amount_cents: number; created_at: string };
export type Sp = { id: number; appeal_id: number; amount_cents: number; created_at: string };
export type Alloc = { donation_id: number; spend_id: number; cents: number };

const byTime = <T extends { created_at: string; id: number }>(a: T, b: T) =>
  a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id;

export function allocateFifo(donations: Don[], spends: Sp[]): Alloc[] {
  const out: Alloc[] = [];
  const appeals = new Set([...donations, ...spends].map((x) => x.appeal_id));
  for (const appeal of appeals) {
    const ds = donations.filter((d) => d.appeal_id === appeal).sort(byTime).map((d) => ({ ...d, left: d.amount_cents }));
    const ss = spends.filter((s) => s.appeal_id === appeal).sort(byTime);
    let i = 0;
    for (const s of ss) {
      let need = s.amount_cents;
      while (need > 0 && i < ds.length) {
        const take = Math.min(need, ds[i].left);
        if (take > 0) out.push({ donation_id: ds[i].id, spend_id: s.id, cents: take });
        ds[i].left -= take;
        need -= take;
        if (ds[i].left === 0) i++;
      }
    }
  }
  return out;
}

export type TraceRow = { spend_id: number | null; label: string; cents: number };

export function traceDonation(donation: Don, donations: Don[], spends: Sp[]): TraceRow[] {
  const rows: TraceRow[] = allocateFifo(donations, spends)
    .filter((a) => a.donation_id === donation.id)
    .map((a) => ({ spend_id: a.spend_id, label: `spend #${a.spend_id}`, cents: a.cents }));
  const used = rows.reduce((n, r) => n + r.cents, 0);
  if (used < donation.amount_cents) rows.push({ spend_id: null, label: "Not yet spent (held in the appeal fund)", cents: donation.amount_cents - used });
  return rows;
}
