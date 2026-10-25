// A spend over 3x the rolling mean of the appeal's last WINDOW accepted spends is held, never paid.
export const WINDOW = 5;
export const FACTOR = 3;
export const MIN_HISTORY = 3;

export type AnomalyResult = { held: boolean; reason: string | null; mean_cents: number | null };

export function checkAnomaly(amount_cents: number, priorAccepted: number[]): AnomalyResult {
  const recent = priorAccepted.slice(-WINDOW);
  if (recent.length < MIN_HISTORY) return { held: false, reason: null, mean_cents: null };
  const mean = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  if (amount_cents > FACTOR * mean) {
    return {
      held: true,
      mean_cents: mean,
      reason: `Held: $${(amount_cents / 100).toFixed(2)} is more than ${FACTOR}x the rolling mean $${(mean / 100).toFixed(2)} of the last ${recent.length} spends in this appeal`,
    };
  }
  return { held: false, reason: null, mean_cents: mean };
}
