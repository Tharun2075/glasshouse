import { userFromRequest, type User } from "./auth.ts";
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
/** Returns the user when the role matches, else a 401/403 Response. */
export function requireRole(req: Request, role: User["role"]): User | Response {
  const u = userFromRequest(req);
  if (!u) return json({ error: "sign in first" }, 401);
  if (u.role !== role) return json({ error: `only a ${role} can do this` }, 403);
  return u;
}
/** Public origin for PayPal return URLs and redirects. Order: APP_ORIGIN, Render's own URL, proxy headers, then the request URL. */
export function origin(req: Request) {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN.replace(/\/$/, "");
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "");
  // Only live money needs a pinned origin; a sandbox demo falls back to the request so sign-in never 500s.
  if (process.env.PAYPAL_ENV === "live") throw new Error("APP_ORIGIN must be set when PAYPAL_ENV=live (e.g. https://glasshouse.example)");
  const first = (v: string | null) => v?.split(",")[0]?.trim() || "";
  const host = first(req.headers.get("x-forwarded-host")) || first(req.headers.get("host"));
  if (host) {
    const proto = first(req.headers.get("x-forwarded-proto")) || new URL(req.url).protocol.replace(":", "");
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}
