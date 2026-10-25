import { one } from "@/lib/db.ts";
import { checkPw, sign, COOKIE } from "@/lib/auth.ts";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const HOME = { donor: "/donate", volunteer: "/volunteer", trustee: "/trustee" } as const;
export async function POST(req: Request) {
  const f = await req.formData();
  const email = String(f.get("email") ?? "").trim().toLowerCase(), pw = String(f.get("password") ?? "");
  const u = one<{ id: number; role: keyof typeof HOME; pw: string }>("SELECT id,role,pw FROM users WHERE email=?", email);
  const o = new URL(req.url).origin;
  if (!u || !checkPw(pw, u.pw)) return Response.redirect(`${o}/login?error=1`, 303);
  const res = new Response(null, { status: 303, headers: { location: `${o}${HOME[u.role]}` } });
  res.headers.append("set-cookie", `${COOKIE}=${encodeURIComponent(sign(u.id))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
  return res;
}
