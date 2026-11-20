import { NextResponse } from "next/server"
import { AIError } from "@/lib/ai"
import { regenerateOne } from "@/lib/ai/rewrite-cv"
import { improveWeak } from "@/lib/rebuild/improve"
import type { RewriteItem } from "@/lib/rewrite/groups"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema } from "@/lib/schemas/offer"

const AI_STATUS = { not_configured: 500, unreachable: 503, model_missing: 503, timeout: 504, invalid_output: 502 } as const

/** Ciclo de calidad de UNA propuesta de texto: si no mejora la ficha, se regenera (máx. 2 rondas) y se vuelve a puntuar. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { cv?: unknown; offer?: unknown; item?: unknown; source?: unknown; rawOfferText?: unknown } | null
  const cv = cvSchema.safeParse(body?.cv)
  const offer = offerSchema.safeParse(body?.offer)
  const item = body?.item as RewriteItem | undefined
  if (!cv.success || !offer.success || !item || typeof item.id !== "string") return NextResponse.json({ error: "Faltan el CV, la oferta o el cambio, o no son válidos." }, { status: 400 })
  const source = typeof body?.source === "string" && body.source.length <= 300_000 ? body.source : JSON.stringify(cv.data)
  try {
    const { items, report } = await improveWeak({
      cv: cv.data, offer: offer.data, items: [item], source, rawOfferText: typeof body?.rawOfferText === "string" ? body.rawOfferText.slice(0, 20_000) : undefined,
      regenerate: (it, feedback) => regenerateOne(cv.data, offer.data, it, feedback, request.signal),
    })
    return NextResponse.json({ item: items[0], report })
  } catch (e) {
    if (e instanceof AIError) return NextResponse.json({ error: e.message, code: e.code }, { status: AI_STATUS[e.code] })
    console.error("[improve]", e)
    return NextResponse.json({ error: "Error inesperado al mejorar el cambio." }, { status: 500 })
  }
}
