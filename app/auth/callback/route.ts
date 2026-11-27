import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { LAST_USER_COOKIE, LAST_USER_MAX_AGE, encodeLastUser } from "@/lib/auth/last-user"
import { registerDevice } from "@/lib/auth/session"
import { createAuthClient } from "@/lib/auth/supabase"

/** Vuelta de Google: canjea el código por la sesión y registra este dispositivo (con su cookie firmada). */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const remember = url.searchParams.get("remember") === "1"
  const fail = () => NextResponse.redirect(new URL("/login?error=google", url.origin))
  if (!code) return fail()
  const store = await cookies()
  const supabase = createAuthClient({ getAll: () => store.getAll(), setAll: (list) => list.forEach((c) => store.set(c.name, c.value, c.options)), remember })
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) return fail()
  try {
    await registerDevice(data.user.id, remember)
  } catch (e) {
    console.error("[auth] no se pudo registrar el dispositivo", e)
    await supabase.auth.signOut({ scope: "local" })
    return NextResponse.redirect(new URL("/login?error=dispositivo", url.origin))
  }
  // Para ofrecer «Continuar como …» la próxima vez en este dispositivo.
  const meta = (data.user.user_metadata ?? {}) as { full_name?: string; name?: string }
  const email = data.user.email ?? ""
  if (email) store.set(LAST_USER_COOKIE, encodeLastUser({ name: meta.full_name ?? meta.name ?? email.split("@")[0], email }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: LAST_USER_MAX_AGE })
  return NextResponse.redirect(new URL("/", url.origin))
}
