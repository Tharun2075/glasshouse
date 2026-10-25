import { createHmac, scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { one } from "./db.ts";

export type User = { id: number; email: string; name: string; role: "donor" | "volunteer" | "trustee" };
export const COOKIE = "gh_session";
/** Cookie attributes; Secure whenever the app is served over https (N4). */
export const cookieAttrs = () => `Path=/; HttpOnly; SameSite=Lax${(process.env.APP_ORIGIN ?? "").startsWith("https") ? "; Secure" : ""}`;
/** Cookies are HMAC-signed with SESSION_SECRET; with no strong secret anyone could forge a trustee cookie, so refuse. */
export function assertSessionSecret() {
  const s = process.env.SESSION_SECRET ?? "";
  if (s.length < 32) throw new Error("SESSION_SECRET is missing or shorter than 32 characters; set it in .env.local (openssl rand -hex 32)");
  return s;
}
const secret = () => assertSessionSecret();

export function hashPw(pw: string) { const s = randomBytes(16); return `${s.toString("hex")}:${scryptSync(pw, s, 32).toString("hex")}`; }
export function checkPw(pw: string, stored: string) {
  const [s, h] = stored.split(":");
  return timingSafeEqual(scryptSync(pw, Buffer.from(s, "hex"), 32), Buffer.from(h, "hex"));
}
export const sign = (uid: number) => `${uid}.${createHmac("sha256", secret()).update(String(uid)).digest("hex")}`;
export function verify(v: string | undefined): number | null {
  if (!v) return null;
  const [uid] = v.split(".");
  const want = sign(Number(uid));
  return v.length === want.length && timingSafeEqual(Buffer.from(v), Buffer.from(want)) ? Number(uid) : null;
}
export function userFromCookie(v: string | undefined): User | null {
  const id = verify(v);
  return id ? one<User>("SELECT id,email,name,role FROM users WHERE id=?", id) ?? null : null;
}
export function userFromRequest(req: Request): User | null {
  const m = (req.headers.get("cookie") ?? "").match(new RegExp(`(?:^|; )${COOKIE}=([^;]+)`));
  return userFromCookie(m ? decodeURIComponent(m[1]) : undefined);
}
