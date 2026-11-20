import { NextResponse } from "next/server"
import { AIError } from "@/lib/ai"
import { matchWithOllama } from "@/lib/match/ai"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema } from "@/lib/schemas/offer"

/**
 * Cruza el CV con la oferta: `{ cv, offer, cvLanguage? }` → `MatchResult` (cobertura ponderada, estado por término con
 * evidencia, y tres grupos: ya encaja / se puede reformular / brecha). Si no hay embeddings, responde solo con
 * coincidencia léxica y un aviso (nunca falla por eso).
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { cv?: unknown; offer?: unknown; cvLanguage?: unknown } | null
  const cv = cvSchema.safeParse(body?.cv)
  const offer = offerSchema.safeParse(body?.offer)
  if (!cv.success || !offer.success) return NextResponse.json({ error: "Faltan el CV o la oferta, o no son válidos." }, { status: 400 })
  const lang = body?.cvLanguage === "en" || body?.cvLanguage === "es" || body?.cvLanguage === "otro" ? body.cvLanguage : undefined
  try {
    const result = await matchWithOllama(cv.data, offer.data, { signal: request.signal, cvLanguage: lang })
    console.info(`[match] ${result.method}${result.model ? ` (${result.model})` : ""} cobertura=${result.coverage}% términos=${result.terms.length}`, JSON.stringify(result.timings))
    return NextResponse.json(result)
  } catch (e) {
    if (e instanceof AIError) return NextResponse.json({ error: e.message, code: e.code }, { status: 503 })
    console.error("[match]", e)
    return NextResponse.json({ error: "Error inesperado al comparar el CV con la oferta." }, { status: 500 })
  }
}
