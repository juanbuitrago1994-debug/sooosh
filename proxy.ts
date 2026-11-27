import { NextResponse, type NextRequest } from "next/server"
import { RATE_PER_MINUTE, policyFor } from "@/lib/auth/api-policy"
import { DEVICE_COOKIE, verifyDevice } from "@/lib/auth/device"
import { LAST_USER_COOKIE, LAST_USER_MAX_AGE, encodeLastUser } from "@/lib/auth/last-user"
import { createLimiter } from "@/lib/auth/rate-limit"
import { createAuthClient } from "@/lib/auth/supabase"

/**
 * Puerta de entrada (Next 16: `proxy`, antes `middleware`). Renueva la sesión de Supabase y manda al login a quien no tenga sesión
 * válida en ESTE dispositivo. Es una comprobación rápida; la definitiva (dispositivo no revocado, registro completo) la hace `lib/auth/session.ts`
 * en cada página y acción.
 * Las rutas `/api/*` también pasan por aquí, con la regla de `lib/auth/api-policy.ts`: por defecto exigen sesión (sin ella, 401 en JSON), solo se abre lo marcado
 * «publica», y hay un límite de peticiones por persona. Los scripts de banco de pruebas entran con la cabecera `x-sooosh-bench` y `BENCH_KEY`, que solo existe en `.env.local`
 * (en producción no está definida y esa vía queda cerrada).
 */
const limiter = createLimiter()
const json401 = () => NextResponse.json({ error: "Inicia sesión para usar esta función." }, { status: 401 })

function benchAllowed(request: NextRequest): boolean {
  const key = process.env.BENCH_KEY
  const given = request.headers.get("x-sooosh-bench")
  if (!key || key.length < 16 || !given || given.length !== key.length) return false
  let diff = 0
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ given.charCodeAt(i)
  return diff === 0
}

const PUBLIC = ["/login", "/auth"]
const isPublic = (path: string) => PUBLIC.some((p) => path === p || path.startsWith(`${p}/`))

export async function proxy(request: NextRequest) {
  const api = request.nextUrl.pathname.startsWith("/api/")
  const rule = api ? policyFor(request.nextUrl.pathname) : undefined
  if (api && rule?.access === "publica") return NextResponse.next()
  const bench = api && benchAllowed(request)
  const device = await verifyDevice(request.cookies.get(DEVICE_COOKIE)?.value)
  let response = NextResponse.next({ request })
  const supabase = createAuthClient({
    getAll: () => request.cookies.getAll(),
    setAll: (list) => {
      for (const c of list) request.cookies.set(c.name, c.value)
      response = NextResponse.next({ request })
      for (const c of list) response.cookies.set(c.name, c.value, c.options)
    },
    remember: device?.remember ?? false,
  })
  const { data } = await supabase.auth.getClaims()
  const signedIn = !!device && data?.claims?.sub === device.userId
  const { pathname } = request.nextUrl

  if (api) {
    if (!signedIn && !bench) return json401()
    const key = bench ? "bench" : (data?.claims?.sub ?? "?")
    const r = limiter(`${key}:${rule?.pesada ? "pesada" : "general"}`, rule?.pesada ? RATE_PER_MINUTE.pesada : RATE_PER_MINUTE.general)
    if (!r.ok) return NextResponse.json({ error: "Demasiadas peticiones seguidas. Espera un momento y vuelve a intentar." }, { status: 429, headers: { "Retry-After": String(r.retryAfterSeconds) } })
    return response
  }
  // Quien ya tenía la sesión abierta antes de existir la tarjeta «Continuar como …» (o la perdió) también la recibe: se guarda el último usuario al ver cualquier página.
  if (signedIn) {
    const email = String(data?.claims?.email ?? "")
    const meta = (data?.claims?.user_metadata ?? {}) as { full_name?: string; name?: string }
    if (email) {
      const value = encodeLastUser({ name: meta.full_name ?? meta.name ?? email.split("@")[0], email })
      if (request.cookies.get(LAST_USER_COOKIE)?.value !== value) response.cookies.set(LAST_USER_COOKIE, value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: LAST_USER_MAX_AGE })
    }
  }

  if (!signedIn && !isPublic(pathname)) return NextResponse.redirect(new URL("/login", request.url))
  if (signedIn && pathname === "/login") return NextResponse.redirect(new URL("/", request.url))
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|txt|json)$).*)"],
}
