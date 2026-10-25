export const toCents = (v: string | number): number => {
  const s = typeof v === "number" ? v.toFixed(2) : v.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`bad amount: ${v}`);
  const [w, f = ""] = s.split(".");
  return Number(w) * 100 + Number((f + "00").slice(0, 2));
};
export const fmt = (cents: number): string =>
  `${cents < 0 ? "-" : ""}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;
export const usd = (cents: number): string => `$${fmt(cents)}`;
