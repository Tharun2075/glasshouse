import { userFromRequest, type User } from "./auth.ts";
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
/** Returns the user when the role matches, else a 401/403 Response. */
export function requireRole(req: Request, role: User["role"]): User | Response {
  const u = userFromRequest(req);
  if (!u) return json({ error: "sign in first" }, 401);
  if (u.role !== role) return json({ error: `only a ${role} can do this` }, 403);
  return u;
}
/** Public origin for PayPal return URLs and redirects. Never trust the Host header in production. */
export function origin(req: Request) {
  if (process.env.APP_ORIGIN) return process.env.APP_ORIGIN.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("APP_ORIGIN must be set in production (e.g. https://glasshouse.example)");
  return new URL(req.url).origin;
}
