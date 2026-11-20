import { NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { enrichStats } from "@/lib/enrich/queue"
import { enrichPending } from "@/lib/enrich/worker"
import { requireAdmin } from "@/lib/jobs/admin"
import { embedMissing } from "@/lib/jobs/embed"

/** Estado de la cola de enriquecimiento con IA (pendientes, hechas, omitidas, fallidas). Solo administrador. */
export async function GET(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied
  try {
    return NextResponse.json(await enrichStats(getDb()))
  } catch (e) {
    console.error("[enrich GET]", e)
    return NextResponse.json({ error: "No se pudo leer la cola." }, { status: 502 })
  }
}

/**
 * Procesa hasta `limit` (1–25) ofertas pobres de la cola con el modelo local; cada una tarda ≈ 10–20 s, así que la respuesta puede demorar
 * unos minutos. Luego calcula los vectores de las que cambiaron. Solo administrador.
 */
export async function POST(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const body = z.object({ limit: z.number().int().min(1).max(25).default(10) }).safeParse(await request.json().catch(() => ({})))
  if (!body.success) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 })
  try {
    const db = getDb()
    const report = await enrichPending(db, body.data.limit, request.signal)
    const embeddings = await embedMissing(db, 120).catch(() => ({ done: 0, pending: 0 }))
    return NextResponse.json({ report, stats: await enrichStats(db), embeddings })
  } catch (e) {
    console.error("[enrich POST]", e)
    return NextResponse.json({ error: "No se pudo enriquecer." }, { status: 502 })
  }
}
