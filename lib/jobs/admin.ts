import { createHash, timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

/**
 * Acceso de administración (solo Juan carga ofertas mientras no existan cuentas): una clave en `.env.local` (ADMIN_TOKEN) que el panel
 * envía en la cabecera `x-admin-token`. Devuelve una respuesta de error si no pasa, o null si pasa. Comparación en tiempo constante.
 */
const sha = (s: string) => createHash("sha256").update(s).digest()

export function requireAdmin(request: Request): NextResponse | null {
  const expected = process.env.ADMIN_TOKEN
  if (!expected || expected.length < 12) {
    return NextResponse.json({ error: "El panel de ofertas no está configurado: falta ADMIN_TOKEN en .env.local (mínimo 12 caracteres)." }, { status: 503 })
  }
  const given = request.headers.get("x-admin-token") ?? ""
  if (!given || !timingSafeEqual(sha(given), sha(expected))) {
    return NextResponse.json({ error: "Clave de administrador incorrecta." }, { status: 401 })
  }
  return null
}
