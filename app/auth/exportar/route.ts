import { NextResponse } from "next/server"
import { buildExport } from "@/lib/account/export"
import { getCurrentUser } from "@/lib/auth/session"
import { getDb } from "@/lib/db"

/** Descarga de todos los datos de la persona (JSON). Sin sesión válida en este dispositivo: 401. */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Inicia sesión para descargar tus datos." }, { status: 401 })
  const data = await buildExport(getDb(), user.id, { email: user.email })
  const day = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="sooosh-mis-datos-${day}.json"`, "Cache-Control": "no-store" },
  })
}
