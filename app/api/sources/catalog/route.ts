import { NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { requireAdmin } from "@/lib/jobs/admin"
import { listCatalog, setSourceActive, setSourceCadence } from "@/lib/sources/catalog"

/** Catálogo de fuentes: lista y cambios de operación (pausar/reanudar y cadencia propia). Solo administrador. */
export async function GET(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied
  try {
    return NextResponse.json({ sources: await listCatalog(getDb()) })
  } catch (e) {
    console.error("[catalog GET]", e)
    return NextResponse.json({ error: "No se pudo leer el catálogo de fuentes." }, { status: 502 })
  }
}

const patchSchema = z.object({ key: z.string().min(3).max(60), active: z.boolean().optional(), cadenceHours: z.number().int().min(1).max(168).nullable().optional() })

export async function PATCH(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const p = patchSchema.safeParse(await request.json().catch(() => null))
  if (!p.success || (p.data.active === undefined && p.data.cadenceHours === undefined)) return NextResponse.json({ error: "Indica la fuente y qué cambiar (activa o cadencia de 1 a 168 horas)." }, { status: 400 })
  try {
    const db = getDb()
    let found = true
    if (p.data.active !== undefined) found = (await setSourceActive(db, p.data.key, p.data.active)) && found
    if (p.data.cadenceHours !== undefined) found = (await setSourceCadence(db, p.data.key, p.data.cadenceHours)) && found
    if (!found) return NextResponse.json({ error: "Esa fuente no está en el catálogo." }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[catalog PATCH]", e)
    return NextResponse.json({ error: "No se pudo actualizar la fuente." }, { status: 502 })
  }
}
