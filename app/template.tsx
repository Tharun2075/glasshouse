"use client";
import { useEffect } from "react";
// Remounts on every navigation: a short fade in, scroll reveal for [data-reveal], and a count-up for stat values.
// All three are skipped under reduced motion; without JS nothing is hidden (the CSS keys off html.js).
export default function Template({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.classList.add("js");
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -10% 0px" });
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    const frames: number[] = [];
    document.querySelectorAll<HTMLElement>(".stats .v").forEach((el) => {
      const text = el.textContent ?? "", m = text.match(/[\d,]+(\.\d+)?/);
      if (el.childElementCount || !m) return;
      const end = Number(m[0].replace(/,/g, "")), dp = m[1] ? m[1].length - 1 : 0, t0 = performance.now();
      const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 900), v = end * (1 - Math.pow(1 - p, 3));
        el.textContent = text.replace(m[0], fmt(p < 1 ? v : end));
        if (p < 1) frames.push(requestAnimationFrame(tick));
      };
      frames.push(requestAnimationFrame(tick));
    });
    return () => { io.disconnect(); frames.forEach(cancelAnimationFrame); };
  }, []);
  return <div className="page-fade">{children}</div>;
}
