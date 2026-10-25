import { userFromRequest, type User } from "./auth.ts";
export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
/** Returns the user when the role matches, else a 401/403 Response. */
export function requireRole(req: Request, role: User["role"]): User | Response {
  const u = userFromRequest(req);
  if (!u) return json({ error: "sign in first" }, 401);
  if (u.role !== role) return json({ error: `only a ${role} can do this` }, 403);
  return u;
}
export const origin = (req: Request) => process.env.APP_ORIGIN ?? new URL(req.url).origin;
