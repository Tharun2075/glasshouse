import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { currentUser } from "@/lib/session.ts";
import NavLinks from "@/components/NavLinks.tsx";
import ThemeToggle from "@/components/ThemeToggle.tsx";
import Footer from "@/components/Footer.tsx";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = { title: "Glasshouse — every dollar, in the open", description: "A transparent ledger for small charities. Sandbox demo." };
// themeColor values are the lock's --bg for light and dark (brand-tokens/tokens.css).
export const viewport: Viewport = { colorScheme: "light dark", themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F6F7FB" }, { media: "(prefers-color-scheme: dark)", color: "#0E1022" }] };
export const dynamic = "force-dynamic";

// Applies a saved light/dark choice before first paint, so there is no flash.
const THEME_JS = `try{var t=localStorage.getItem("gh-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  const links = [{ href: "/", label: "Public ledger" }, { href: "/donate", label: "Donate" }];
  if (u?.role === "volunteer") links.push({ href: "/volunteer", label: "Upload receipt" });
  if (u?.role === "trustee") links.push({ href: "/trustee", label: "Approvals" });
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_JS }} /></head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="top">
          <a className="brand" href="/" aria-label="Glasshouse home"><img src="/brand/logo-mark.svg" alt="" width={28} height={28} /><span className="word">Glasshouse</span></a>
          <NavLinks links={links} />
          <div className="who">
            {u ? (<><span>{u.name} ({u.role})</span><form action="/api/auth/logout" method="post"><button className="ghost" type="submit">Sign out</button></form></>)
               : <a href="/login">Sign in</a>}
            <ThemeToggle />
          </div>
        </header>
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
