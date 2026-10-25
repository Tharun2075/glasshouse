import { cookies } from "next/headers";
import { userFromCookie, COOKIE } from "./auth.ts";
export async function currentUser() { return userFromCookie((await cookies()).get(COOKIE)?.value); }
