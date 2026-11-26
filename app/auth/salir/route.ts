import { NextResponse } from "next/server"
import { signOutThisDevice } from "@/lib/auth/session"

/** Cierra la sesión de este dispositivo. Solo POST (un enlace o una imagen ajena no puede cerrarla). */
export async function POST(request: Request) {
  await signOutThisDevice()
  return NextResponse.redirect(new URL("/login", request.url), 303)
}
