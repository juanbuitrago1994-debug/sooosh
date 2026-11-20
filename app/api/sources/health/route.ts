import { NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { requireAdmin } from "@/lib/jobs/admin"
import { syncHealth } from "@/lib/sources/schedule"

/** Estado de la sincronización automática por fuente (último éxito, error, atrasada). Solo administrador. */
export async function GET(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied
  try {
    return NextResponse.json({ sources: await syncHealth(getDb()) })
  } catch (e) {
    console.error("[sources health]", e)
    return NextResponse.json({ error: "No se pudo leer el estado." }, { status: 502 })
  }
}
