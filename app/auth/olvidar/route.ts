import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { LAST_USER_COOKIE } from "@/lib/auth/last-user"

/** «Quitar» el último usuario de este dispositivo (la tarjeta «Continuar como …» de la pantalla de entrada). Solo POST. */
export async function POST(request: Request) {
  ;(await cookies()).delete(LAST_USER_COOKIE)
  return NextResponse.redirect(new URL("/login", request.url), 303)
}
