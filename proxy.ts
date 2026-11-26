import { NextResponse, type NextRequest } from "next/server"
import { DEVICE_COOKIE, verifyDevice } from "@/lib/auth/device"
import { createAuthClient } from "@/lib/auth/supabase"

/**
 * Puerta de entrada (Next 16: `proxy`, antes `middleware`). Renueva la sesión de Supabase y manda al login a quien no tenga sesión
 * válida en ESTE dispositivo. Es una comprobación rápida; la definitiva (dispositivo no revocado, registro completo) la hace `lib/auth/session.ts`
 * en cada página y acción. Las rutas `/api/*` no pasan por aquí en esta fase (ver docs/STATUS.md).
 */
const PUBLIC = ["/login", "/auth"]
const isPublic = (path: string) => PUBLIC.some((p) => path === p || path.startsWith(`${p}/`))

export async function proxy(request: NextRequest) {
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

  if (!signedIn && !isPublic(pathname)) return NextResponse.redirect(new URL("/login", request.url))
  if (signedIn && pathname === "/login") return NextResponse.redirect(new URL("/", request.url))
  return response
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|txt|json)$).*)"],
}
