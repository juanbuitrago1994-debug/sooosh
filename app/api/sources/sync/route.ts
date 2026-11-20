import { NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { requireAdmin } from "@/lib/jobs/admin"
import { listCompanies, type Ats } from "@/lib/sources/companies"
import { embedAfterSync, PORTALS, REMOTE_SOURCES, syncAllCompanies, syncCompany, syncGetOnBoard, syncPortal, syncRemote } from "@/lib/sources/sync"

/**
 * Sincroniza fuentes: `{ target: "getonboard" | "companies" | "<id de empresa>" }`. Devuelve un informe por fuente (leídas, fuera de la
 * región, duplicadas, nuevas, actualizadas, cerradas). Solo administrador. Tarda: Get on Board ≈ 15–30 s; cada empresa 1–3 s.
 */
export async function POST(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const body = z.object({ target: z.string().min(3).max(40) }).safeParse(await request.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: "Indica qué sincronizar." }, { status: 400 })
  try {
    const db = getDb()
    const { target } = body.data
    let reports
    if (target === "getonboard") reports = [await syncGetOnBoard(db)]
    else if (target === "companies") reports = await syncAllCompanies(db)
    else if (target.startsWith("portal:")) {
      const cfg = PORTALS.find((p) => `portal:${p.key}` === target)
      if (!cfg) return NextResponse.json({ error: "Ese portal no está disponible." }, { status: 404 })
      reports = [await syncPortal(db, cfg)]
    }
    else if (target.startsWith("remote:")) {
      const s = REMOTE_SOURCES.find((x) => `remote:${x.key}` === target)
      if (!s) return NextResponse.json({ error: "Esa fuente no está disponible." }, { status: 404 })
      reports = [await syncRemote(db, s.key)]
    } else {
      const c = (await listCompanies(db)).find((x) => x.id === target)
      if (!c) return NextResponse.json({ error: "Esa empresa no está en el directorio." }, { status: 404 })
      reports = [await syncCompany(db, { id: c.id, ats: c.ats as Ats, token: c.token, name: c.name })]
    }
    const embeddings = await embedAfterSync(db)
    return NextResponse.json({ reports, embeddings })
  } catch (e) {
    console.error("[sources sync]", e)
    return NextResponse.json({ error: "No se pudo sincronizar." }, { status: 502 })
  }
}
