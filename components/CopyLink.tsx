"use client";
import { useState } from "react";
import { Check, Link2 } from "lucide-react";
export default function CopyLink() {
  const [done, setDone] = useState(false);
  async function copy() { await navigator.clipboard.writeText(window.location.href.split("?")[0]); setDone(true); setTimeout(() => setDone(false), 2000); }
  return <button className="ghost" type="button" onClick={copy} aria-live="polite">{done ? <><Check className="icon" aria-hidden size={16} />Link copied</> : <><Link2 className="icon" aria-hidden size={16} />Copy link to share</>}</button>;
}
