"use client";
import { usePathname } from "next/navigation";

/** Main nav with aria-current on the page you are on. */
export default function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main">
      {links.map((l) => {
        const on = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return <a key={l.href} href={l.href} aria-current={on ? "page" : undefined}>{l.label}</a>;
      })}
    </nav>
  );
}
