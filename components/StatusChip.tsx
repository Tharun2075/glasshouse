import { BadgeCheck, CircleCheck, CircleX, Clock, ShieldAlert, TriangleAlert } from "lucide-react";

const ICON = { approved: CircleCheck, paid: BadgeCheck, held: ShieldAlert, pending: Clock, rejected: CircleX } as const;
const WORD: Record<string, string> = { MISMATCH: "mismatch" };

/** Status as icon plus word, never colour alone. Keeps the `pill <status>` class the tests and CSS key on. */
export default function StatusChip({ status }: { status: string }) {
  const Icon = ICON[status as keyof typeof ICON] ?? TriangleAlert;
  return <span className={`pill ${status}`}><Icon className="icon" aria-hidden size={14} />{WORD[status] ?? status}</span>;
}
