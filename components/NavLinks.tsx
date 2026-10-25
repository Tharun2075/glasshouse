"use client";
import { usePathname } from "next/navigation";

/** Main nav with aria-current on the page you are on. */
export default function NavLinks({ links }: { links: { href: string; label: string; short?: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main">
      {links.map((l) => {
        const on = path.startsWith(l.href);
        return <a key={l.href} href={l.href} aria-current={on ? "page" : undefined}>{l.short ? <><span className="nl-long">{l.label}</span><span className="nl-short">{l.short}</span></> : l.label}</a>;
      })}
    </nav>
  );
}
