"use client";
import { useState } from "react";
export default function CopyLink() {
  const [done, setDone] = useState(false);
  async function copy() { await navigator.clipboard.writeText(window.location.href.split("?")[0]); setDone(true); setTimeout(() => setDone(false), 2000); }
  return <button className="ghost" type="button" onClick={copy}>{done ? "Link copied" : "Copy link to share"}</button>;
}
