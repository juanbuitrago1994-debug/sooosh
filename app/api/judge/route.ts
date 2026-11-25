import { NextResponse } from "next/server"
import { AIError } from "@/lib/ai"
import { judgeCv } from "@/lib/analysis/judge"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema } from "@/lib/schemas/offer"

const AI_STATUS = { not_configured: 500, unreachable: 503, model_missing: 503, timeout: 504, invalid_output: 502 } as const

/** Juez local (K4): evalúa la fórmula del resumen, la estructura de los logros y las habilidades transversales. Opcional: la ficha ya funciona sin él. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { cv?: unknown; offer?: unknown } | null
  const cv = cvSchema.safeParse(body?.cv)
  const offer = offerSchema.safeParse(body?.offer)
  if (!cv.success || !offer.success) return NextResponse.json({ error: "Faltan el CV o la oferta, o no son válidos." }, { status: 400 })
  try {
    return NextResponse.json({ judged: await judgeCv(cv.data, offer.data, request.signal) })
  } catch (e) {
    if (e instanceof AIError) return NextResponse.json({ error: e.message, code: e.code }, { status: AI_STATUS[e.code] })
    if ((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError") return NextResponse.json({ error: "El modelo tardó demasiado en evaluar. La ficha sigue siendo válida sin esta parte." }, { status: 504 })
    console.error("[judge]", e)
    return NextResponse.json({ error: "Error inesperado al evaluar con el modelo." }, { status: 500 })
  }
}
