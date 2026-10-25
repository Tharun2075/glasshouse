import { CookingPot, HeartHandshake, Package, Truck } from "lucide-react";

/** A picture for an appeal, chosen from words in its title. */
export default function AppealIcon({ title, size = 22 }: { title: string; size?: number }) {
  const t = title.toLowerCase();
  const Icon = /van|fuel|deliver/.test(t) ? Truck : /kitchen|equip/.test(t) ? CookingPot : /food|parcel/.test(t) ? Package : HeartHandshake;
  return <Icon className="icon" aria-hidden size={size} />;
}
