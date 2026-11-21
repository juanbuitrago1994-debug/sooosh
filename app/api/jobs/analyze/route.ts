import { NextResponse } from "next/server"
import { AIError } from "@/lib/ai"
import { parseOfferText } from "@/lib/ai/parse-offer"
import { sha256 } from "@/lib/cache/results"
import { getDb } from "@/lib/db"
import { buildDraft } from "@/lib/jobs/draft"
import { buildEvidence } from "@/lib/jobs/evidence"
import { requireAdmin } from "@/lib/jobs/admin"
import { findJobByUrl } from "@/lib/jobs/store"
import { cleanOfferText } from "@/lib/offer/clean"
import { fetchOffer, OfferError } from "@/lib/offer/fetch-url"
import { OFFER_MAX_CHARS, OFFER_MIN_CHARS } from "@/lib/schemas/offer"

const AI_STATUS = { not_configured: 500, unreachable: 503, model_missing: 503, timeout: 504, invalid_output: 502 } as const
const OFFER_STATUS = { invalid_url: 400, blocked_host: 400, login_required: 422, unreachable: 502, not_html: 422, empty: 422, too_large: 413 } as const

/**
 * Analiza una oferta (enlace o texto pegado) y devuelve el BORRADOR de la tarjeta; no guarda nada.
 * Reutiliza el pipeline de «coincidencia»: extracción determinista → limpieza con el modelo local → estructura con guardia anti-invención.
 * `{ url }` o `{ text, link? }`. Solo administrador.
 */
export async function POST(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied
  const body = (await request.json().catch(() => null)) as { url?: unknown; text?: unknown; link?: unknown } | null
  try {
    let raw: string
    let ld
    let pageCompany: string | undefined
    let url: string | undefined
    if (typeof body?.url === "string" && body.url.trim()) {
      const page = await fetchOffer(body.url.trim(), { signal: request.signal })
      raw = page.text
      ld = page.ld
      pageCompany = page.company
      url = body.url.trim()
    } else if (typeof body?.text === "string") {
      raw = body.text.trim()
      if (raw.length < OFFER_MIN_CHARS) {
        return NextResponse.json({ error: `La oferta es muy corta (${raw.length} de ${OFFER_MIN_CHARS} caracteres como mínimo). Pega el texto completo.` }, { status: 400 })
      }
      if (raw.length > OFFER_MAX_CHARS * 2) return NextResponse.json({ error: `La oferta es demasiado larga (máximo ${OFFER_MAX_CHARS} caracteres).` }, { status: 413 })
      url = typeof body.link === "string" && body.link.trim() ? body.link.trim() : undefined
    } else {
      return NextResponse.json({ error: "Envía el enlace o el texto de la oferta." }, { status: 400 })
    }
    const cleaning = await cleanOfferText(raw, { signal: request.signal })
    const text = cleaning.text.slice(0, OFFER_MAX_CHARS)
    if (text.length < 60) {
      throw new OfferError("empty", "No encontramos el contenido de la oferta. Copia el texto de la oferta y pégalo en «Pegar texto».")
    }
    const { data: offer, dropped } = await parseOfferText(text, request.signal)
    const draft = buildDraft({ offer, text, url, link: typeof body?.link === "string" ? body.link : undefined, ld, company: pageCompany, fallbackHash: sha256(text).slice(0, 24) })
    const existing = await findJobByUrl(getDb(), draft.sourceUrl).catch(() => null)
    return NextResponse.json({ draft, evidence: buildEvidence(draft, text, { companyFromPage: !!pageCompany }), existing, dropped, cleaning: { removed: cleaning.removed, warning: cleaning.warning } })
  } catch (e) {
    if (e instanceof OfferError) return NextResponse.json({ error: e.message, code: e.code }, { status: OFFER_STATUS[e.code] })
    if (e instanceof AIError) return NextResponse.json({ error: e.message, code: e.code }, { status: AI_STATUS[e.code] })
    console.error("[jobs/analyze]", e)
    return NextResponse.json({ error: "Error inesperado al analizar la oferta." }, { status: 500 })
  }
}
