import { NextResponse } from "next/server"
import { buildChangeSet } from "@/lib/changes/propose"
import { getDb } from "@/lib/db"
import { recentDecisions } from "@/lib/learning/store"
import type { RewriteItem } from "@/lib/rewrite/groups"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema } from "@/lib/schemas/offer"

/**
 * Cambios para revisar (K5): los que ya propuso la reescritura + los estructurales + las brechas, cada uno con tipo, motivo, evidencia,
 * riesgo y efecto estimado en la ficha. Es determinista y rápido (no usa el modelo). La prioridad tiene en cuenta lo que la persona
 * ha aceptado o rechazado antes (memoria de preferencias local).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { cv?: unknown; offer?: unknown; items?: unknown; rawOfferText?: unknown } | null
  const cv = cvSchema.safeParse(body?.cv)
  const offer = offerSchema.safeParse(body?.offer)
  if (!cv.success || !offer.success) return NextResponse.json({ error: "Faltan el CV o la oferta, o no son válidos." }, { status: 400 })
  const existing = Array.isArray(body?.items) ? (body.items as RewriteItem[]).filter((i) => i && typeof i.id === "string") : []
  const rawOfferText = typeof body?.rawOfferText === "string" ? body.rawOfferText.slice(0, 20_000) : undefined
  let history: { ref: string; decision: string }[] = []
  try {
    history = (await recentDecisions(await getDb(), 200)).map((d) => ({ ref: d.ref, decision: d.decision }))
  } catch (e) {
    console.error("[changes] sin historial:", (e as Error).message)
  }
  const { items, before } = buildChangeSet(cv.data, offer.data, existing, { history, rawOfferText })
  return NextResponse.json({ items, fit: { overall: before.overall, scorecard: before.scorecard, warnings: before.warnings } })
}
