import { NextResponse } from "next/server"
import { rebuildCv } from "@/lib/rebuild/build"
import type { Decisions, RewriteItem } from "@/lib/rewrite/groups"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema } from "@/lib/schemas/offer"

/** CV final: aplica solo lo aceptado, verifica que no haya nada inventado y devuelve el informe de cambios. Determinista (sin modelo). */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { cv?: unknown; offer?: unknown; items?: unknown; decisions?: unknown; source?: unknown; rawOfferText?: unknown } | null
  const cv = cvSchema.safeParse(body?.cv)
  const offer = offerSchema.safeParse(body?.offer)
  if (!cv.success || !offer.success || !Array.isArray(body?.items) || typeof body?.decisions !== "object" || !body.decisions) {
    return NextResponse.json({ error: "Faltan el CV, la oferta, los cambios o las decisiones, o no son válidos." }, { status: 400 })
  }
  const source = typeof body.source === "string" && body.source.length <= 300_000 ? body.source : ""
  const { cv: final, report } = rebuildCv({ cv: cv.data, offer: offer.data, items: body.items as RewriteItem[], decisions: body.decisions as Decisions, source: source || JSON.stringify(cv.data), rawOfferText: typeof body.rawOfferText === "string" ? body.rawOfferText.slice(0, 20_000) : undefined })
  return NextResponse.json({ cv: final, report: { ...report, fitBefore: { overall: report.fitBefore.overall }, fitAfter: { overall: report.fitAfter.overall, scorecard: report.fitAfter.scorecard } } })
}
