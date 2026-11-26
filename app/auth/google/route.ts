import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createAuthClient } from "@/lib/auth/supabase"

/** Empieza el login con Google. `?remember=1` = «Mantener sesión iniciada en este dispositivo». Siempre pide elegir cuenta. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const remember = url.searchParams.get("remember") === "1"
  const store = await cookies()
  const supabase = createAuthClient({ getAll: () => store.getAll(), setAll: (list) => list.forEach((c) => store.set(c.name, c.value, c.options)), remember })
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${url.origin}/auth/callback?remember=${remember ? 1 : 0}`, queryParams: { prompt: "select_account" } },
  })
  if (error || !data.url) return NextResponse.redirect(new URL("/login?error=google", url.origin))
  return NextResponse.redirect(data.url)
}
