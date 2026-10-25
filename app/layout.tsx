import "./globals.css";
import type { Metadata } from "next";
import { currentUser } from "@/lib/session.ts";

export const metadata: Metadata = { title: "Glasshouse — every dollar, in the open", description: "A transparent ledger for small charities. Sandbox demo." };
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const u = await currentUser();
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <header className="top">
          <a className="brand" href="/"><img src="/brand/logo-mark.svg" alt="" width={28} height={28} />Glasshouse</a>
          <nav aria-label="Main">
            <a href="/">Public ledger</a>
            <a href="/donate">Donate</a>
            {u?.role === "volunteer" && <a href="/volunteer">Upload receipt</a>}
            {u?.role === "trustee" && <a href="/trustee">Approvals</a>}
          </nav>
          <div className="who">
            {u ? (<><span>{u.name} ({u.role})</span><form action="/api/auth/logout" method="post"><button className="ghost" type="submit">Sign out</button></form></>)
               : <a href="/login">Sign in</a>}
          </div>
        </header>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
