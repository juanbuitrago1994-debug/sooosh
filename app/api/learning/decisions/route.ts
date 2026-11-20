import { NextResponse } from "next/server"
import { z } from "zod"
import { getDb } from "@/lib/db"
import { getStats, recordDecision, setDecisionReason } from "@/lib/learning/store"
import { maybeSummarize } from "@/lib/learning/summarize"

const decisionSchema = z.object({
  ref: z.string().min(1).max(200),
  kind: z.enum(["cambiar", "quitar", "añadir"]),
  section: z.string().max(60),
  risk: z.string().max(10),
  original: z.string().max(3000),
  proposal: z.string().max(3000),
  decision: z.enum(["aceptado", "rechazado", "editado"]),
  editedText: z.string().max(3000).optional(),
  reason: z.string().max(300).optional(),
  changeReason: z.string().max(300).optional(),
  offerTitle: z.string().max(200).optional(),
  language: z.string().max(10).optional(),
})

let summarizing = false

/** Guarda (o actualiza) una decisión. Cada cierto número de decisiones el modelo resume las preferencias, en segundo plano. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = decisionSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "La decisión no es válida." }, { status: 400 })
  try {
    const db = await getDb()
    await recordDecision(db, parsed.data)
    const stats = await getStats(db)
    if (!summarizing) {
      summarizing = true
      void maybeSummarize(db)
        .catch((e) => console.error("[learning] no se pudo resumir:", (e as Error).message))
        .finally(() => {
          summarizing = false
        })
    }
    return NextResponse.json({ ok: true, stats })
  } catch (e) {
    console.error("[learning]", e)
    return NextResponse.json({ error: "No se pudo guardar la decisión." }, { status: 500 })
  }
}

/** Motivo opcional que la persona añade a una decisión ya guardada. */
export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as { ref?: unknown; reason?: unknown } | null
  if (typeof body?.ref !== "string" || typeof body.reason !== "string") return NextResponse.json({ error: "Faltan datos." }, { status: 400 })
  try {
    await setDecisionReason(await getDb(), body.ref, body.reason)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[learning]", e)
    return NextResponse.json({ error: "No se pudo guardar el motivo." }, { status: 500 })
  }
}
