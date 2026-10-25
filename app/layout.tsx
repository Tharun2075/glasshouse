import "./fonts.css";
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { currentUser } from "@/lib/session.ts";
import NavLinks from "@/components/NavLinks.tsx";
import ThemeToggle from "@/components/ThemeToggle.tsx";
import Footer from "@/components/Footer.tsx";

const title = "Glasshouse — every dollar, in the open";
const description = "A transparent ledger for small charities. Sandbox demo.";
const og = { url: "/og.png", width: 1200, height: 630, alt: "Glasshouse: a glass house holding a charity's ledger" };
// SITE_URL makes og:image absolute on the deployed site; the live Render URL is the default (env overrides).
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "https://glasshouse-1a5k.onrender.com"),
  title, description,
  openGraph: { title, description, type: "website", images: [og] },
  twitter: { card: "summary_large_image", title, description, images: [og.url] },
};
// Dark is the default; only a stored "light" choice changes it (system preference is ignored, PLAN 2.1).
export const viewport: Viewport = { colorScheme: "dark light" };
export const dynamic = "force-dynamic";

// Applies a saved light choice before first paint, so there is no flash; anything else stays dark.
const THEME_JS = `try{if(localStorage.getItem("gh-theme")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  const links = [{ href: "/ledger", label: "Public ledger", short: "Ledger" }, { href: "/donate", label: "Donate", short: "Give" }];
  if (u?.role === "volunteer") links.push({ href: "/volunteer", label: "Upload receipt", short: "Receipt" });
  if (u?.role === "trustee") links.push({ href: "/trustee", label: "Approvals", short: "Approve" });
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
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
