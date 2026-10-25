"use client";
import { Moon, Sun } from "lucide-react";

/** Flips light/dark; the choice is kept in localStorage and applied before paint by the script in layout.tsx. */
export default function ThemeToggle() {
  const flip = () => {
    const el = document.documentElement;
    const dark = el.dataset.theme ? el.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    el.dataset.theme = next;
    try { localStorage.setItem("gh-theme", next); } catch {}
  };
  return (
    <button type="button" className="ghost theme-toggle" onClick={flip} aria-label="Switch light or dark theme" title="Switch theme">
      <span className="sun"><Sun className="icon" aria-hidden size={18} /></span>
      <span className="moon"><Moon className="icon" aria-hidden size={18} /></span>
    </button>
  );
}
