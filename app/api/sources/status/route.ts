import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { sourceStatuses } from "@/lib/sources/status"

/** Estado público de las fuentes (sin errores técnicos: solo mensajes simples). Se puede cachear 60 s. */
export async function GET() {
  try {
    return NextResponse.json({ sources: await sourceStatuses(getDb()) }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } })
  } catch (e) {
    console.error("[sources status]", e)
    return NextResponse.json({ error: "No se pudo leer el estado de las fuentes." }, { status: 502 })
  }
}
