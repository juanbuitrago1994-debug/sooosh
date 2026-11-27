import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { LAST_USER_COOKIE, parseLastUser } from "@/lib/auth/last-user"
import { createAuthClient } from "@/lib/auth/supabase"

/**
 * Empieza el login con Google. `?remember=1` = «Mantener sesión iniciada en este dispositivo». Por defecto pide elegir cuenta; con `?cuenta=ultima` sugiere a Google el último
 * correo de este dispositivo (`login_hint`, tomado de la cookie del servidor, nunca de la dirección) y no obliga a elegir de nuevo.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const remember = url.searchParams.get("remember") === "1"
  const store = await cookies()
  const last = url.searchParams.get("cuenta") === "ultima" ? parseLastUser(store.get(LAST_USER_COOKIE)?.value) : null
  const supabase = createAuthClient({ getAll: () => store.getAll(), setAll: (list) => list.forEach((c) => store.set(c.name, c.value, c.options)), remember })
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${url.origin}/auth/callback?remember=${remember ? 1 : 0}`, queryParams: last ? { login_hint: last.email } : { prompt: "select_account" } },
  })
  if (error || !data.url) return NextResponse.redirect(new URL("/login?error=google", url.origin))
  return NextResponse.redirect(data.url)
}
