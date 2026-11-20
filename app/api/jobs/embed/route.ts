import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { requireAdmin } from "@/lib/jobs/admin"
import { embedMissing } from "@/lib/jobs/embed"

/** Calcula los vectores de búsqueda que falten (tarjetas guardadas con Ollama apagado). Solo administrador. */
export async function POST(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied
  try {
    return NextResponse.json(await embedMissing(getDb()))
  } catch (e) {
    console.error("[jobs/embed]", e)
    return NextResponse.json({ error: "No se pudieron calcular los vectores." }, { status: 502 })
  }
}
