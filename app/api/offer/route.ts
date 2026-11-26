import { NextResponse } from "next/server"
import { AIError } from "@/lib/ai"
import { parseOfferText } from "@/lib/ai/parse-offer"
import { cacheEnabled, getCached, putCached, sha256, versionFor } from "@/lib/cache/results"
import { getCacheDb } from "@/lib/db/cache"
import { cleanOfferText } from "@/lib/offer/clean"
import { fetchOffer, OfferError } from "@/lib/offer/fetch-url"
import { OFFER_MAX_CHARS, OFFER_MIN_CHARS } from "@/lib/schemas/offer"

const AI_STATUS = { not_configured: 500, unreachable: 503, model_missing: 503, timeout: 504, invalid_output: 502 } as const
const OFFER_STATUS = { invalid_url: 400, blocked_host: 400, login_required: 422, unreachable: 502, not_html: 422, empty: 422, too_large: 413 } as const

/**
 * Pipeline de ofertas en capas:
 *  1. extracción determinista (JSON-LD, selectores por sitio, Readability);
 *  2. limpieza con el modelo local (solo deja contenido propio de la oferta);
 *  3. estructuración con el modelo local + guardia anti-invención (toda frase debe existir en el texto fuente).
 *
 * `{ url }`  → capas 1 y 2: devuelve `{ text, method, site?, removed, llm, warning? }` para que el usuario lo revise.
 * `{ text, cleaned? }` → (capa 2 si no viene ya limpio) y capa 3: devuelve `{ offer, text, dropped, cleaning }`.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { text?: unknown; url?: unknown; cleaned?: unknown } | null
  try {
    if (typeof body?.url === "string") {
      const page = await fetchOffer(body.url, { signal: request.signal })
      const c = await cleanOfferText(page.text, { signal: request.signal })
      if (c.text.length < 60) {
        throw new OfferError("empty", "No encontramos el contenido de la oferta en esa página. Copia el texto de la oferta y pégalo en la pestaña «Pegar texto».")
      }
      return NextResponse.json({ text: c.text, method: page.method, site: page.site, removed: c.removed, llm: c.llm, warning: c.warning, postedAt: page.ld?.datePosted, validThrough: page.ld?.validThrough })
    }
    if (typeof body?.text === "string") {
      const raw = body.text.trim()
      if (raw.length < OFFER_MIN_CHARS) {
        return NextResponse.json(
          { error: `La oferta es muy corta (${raw.length} de ${OFFER_MIN_CHARS} caracteres como mínimo). Pega el texto completo.` },
          { status: 400 },
        )
      }
      if (raw.length > OFFER_MAX_CHARS * 2) {
        return NextResponse.json({ error: `La oferta es demasiado larga (máximo ${OFFER_MAX_CHARS} caracteres).` }, { status: 413 })
      }
      // ¿Ya se analizó exactamente este texto? Se reutiliza (huella = hash del texto + si ya venía limpio).
      const key = `offer:${sha256(raw + (body.cleaned === true ? "|limpio" : ""))}`
      const version = versionFor("offer")
      const db = cacheEnabled() ? await getCacheDb().catch(() => null) : null
      const hit = db ? await getCached<Record<string, unknown>>(db, key, "offer", version).catch(() => null) : null
      if (hit) return NextResponse.json({ ...hit, cache: true })
      const cleaning = body.cleaned === true ? { text: raw, removed: 0, llm: false, warning: undefined } : await cleanOfferText(raw, { signal: request.signal })
      const text = cleaning.text.slice(0, OFFER_MAX_CHARS)
      if (text.length < OFFER_MIN_CHARS) {
        return NextResponse.json({ error: "Tras quitar comentarios y ruido quedó muy poco texto. Revisa que hayas pegado la oferta completa." }, { status: 400 })
      }
      const { data, meta, dropped } = await parseOfferText(text, request.signal)
      const payload = { offer: data, text, dropped, meta, cleaning: { removed: cleaning.removed, llm: cleaning.llm, warning: cleaning.warning } }
      if (db) await putCached(db, key, "offer", version, payload).catch(() => {})
      return NextResponse.json(payload)
    }
    return NextResponse.json({ error: "Envía el texto o el enlace de la oferta." }, { status: 400 })
  } catch (e) {
    if (e instanceof OfferError) return NextResponse.json({ error: e.message, code: e.code }, { status: OFFER_STATUS[e.code] })
    if (e instanceof AIError) return NextResponse.json({ error: e.message, code: e.code }, { status: AI_STATUS[e.code] })
    console.error("[offer]", e)
    return NextResponse.json({ error: "Error inesperado al leer la oferta." }, { status: 500 })
  }
}
