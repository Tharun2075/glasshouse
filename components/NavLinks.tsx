"use client";
import { usePathname } from "next/navigation";

/** Main nav with aria-current on the page you are on. Same markup as the landing's .site-nav. */
export default function NavLinks({ links }: { links: { href: string; label: string; short?: string }[] }) {
  const path = usePathname();
  return (
    <nav className="site-nav" aria-label="Primary">
      <ul>
        {links.map((l) => {
          const on = path.startsWith(l.href);
          return <li key={l.href}><a href={l.href} aria-current={on ? "page" : undefined}>{l.short ? <><span className="nl-long">{l.label}</span><span className="nl-short">{l.short}</span></> : l.label}</a></li>;
        })}
      </ul>
    </nav>
  );
}
