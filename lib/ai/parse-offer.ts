import { tidyOffer } from "@/lib/offer/tidy"
import { fold } from "@/lib/keywords/normalize"
import { existsInSource, guardList } from "@/lib/offer/guard"
import { reconcileOffer } from "@/lib/offer/segment"
import { offerSchema, OFFER_MAX_CHARS, type Offer } from "@/lib/schemas/offer"
import { labelOffer } from "./parse-offer-lines"
import { getProvider } from "./index"

export const OFFER_SYSTEM_PROMPT = `Eres un extractor de datos de ofertas de trabajo. Recibes el texto de una oferta y devuelves un JSON con la estructura pedida.

REGLA DE ORO: extrae SOLO lo que está escrito en la oferta.
- No inventes requisitos, tecnologías, años de experiencia ni beneficios. Si algo no aparece, omite el campo o deja la lista vacía.
- Copia las frases tal como están escritas (nombres de tecnologías, herramientas y títulos tal cual); no traduzcas ni parafrasees.
- "requirements": lo obligatorio o imprescindible. "niceToHave": lo que se "valora", "deseable" o "plus". "responsibilities": las funciones del puesto. Un elemento por idea, en frases cortas.
- "tools": herramientas y tecnologías nombradas (una por elemento). "softSkills": habilidades blandas nombradas.
- "seniority": solo si la oferta lo indica (practicante, junior, semi-senior, senior, lead, directivo); si no, "no-especificado".
- "yearsExperience": solo si hay cifras explícitas ("3 a 5 años" → min 3, max 5; "mínimo 2 años" → min 2).
- "languagesRequired": idiomas que se EXIGEN al candidato (con nivel si lo dice), no el idioma en que está escrita la oferta.
- "title": el cargo ofrecido. "company": solo si se nombra.
- "language": "es" si la oferta está en español, "en" si está en inglés, "otro" en cualquier otro caso.
- Ignora menús, avisos de cookies, comentarios de otras personas y texto ajeno a la oferta.
Responde únicamente con el JSON.`

const SENIORITY_WORDS: Record<string, RegExp> = {
  practicante: /practicante|pasante|trainee|intern(ship)?|becari/,
  junior: /\bjunior\b|\bjr\b|entry[- ]level|\binicial\b/,
  "semi-senior": /semi[- ]?senior|\bssr\b|mid[- ]?level|intermedi/,
  senior: /(?<!semi[- ]?)\bsenior\b|(?<!semi[- ]?)\bsr\b|experiencia avanzada/,
  lead: /\blead\b|l[ií]der|\bhead\b|principal|staff|jefe|coordinador/,
  directivo: /director|gerente|\bvp\b|\bcto\b|\bcio\b|\bceo\b/,
}

export type OfferParseResult = {
  data: Offer
  meta: { provider: string; model: string; ms: number; attempts: number }
  /** frases que el modelo devolvió pero NO están en el texto fuente (descartadas) */
  dropped: string[]
}

/** Capa 3: toda frase de la salida debe existir en el texto fuente; lo demás se descarta y se informa. */
export function guardOffer(offer: Offer, source: string): { offer: Offer; dropped: string[] } {
  const dropped: string[] = []
  const list = (xs: string[] | undefined) => {
    const g = guardList(xs ?? [], source)
    dropped.push(...g.dropped)
    return g.kept
  }
  const out: Offer = {
    ...offer,
    requirements: list(offer.requirements),
    niceToHave: list(offer.niceToHave),
    responsibilities: list(offer.responsibilities),
  }
  if (offer.tools) out.tools = list(offer.tools)
  if (offer.softSkills) out.softSkills = list(offer.softSkills)
  if (offer.languagesRequired) {
    out.languagesRequired = offer.languagesRequired.filter((l) => {
      const ok = existsInSource(l.language, source).ok
      if (!ok) dropped.push(l.language)
      return ok
    })
  }
  if (offer.company && !existsInSource(offer.company, source).ok) {
    dropped.push(offer.company)
    out.company = undefined
  }
  // El título es obligatorio: si no aparece literal, se conserva pero se avisa (no se inventa otro).
  if (!existsInSource(offer.title, source).ok) dropped.push(`título no literal: ${offer.title}`)
  if (offer.seniority && offer.seniority !== "no-especificado") {
    const re = SENIORITY_WORDS[offer.seniority]
    if (re && !re.test(fold(source))) {
      dropped.push(`seniority: ${offer.seniority}`)
      out.seniority = "no-especificado"
    }
  }
  if (offer.yearsExperience) {
    const nums = [offer.yearsExperience.min, offer.yearsExperience.max].filter((n): n is number => n !== undefined)
    const hasAll = nums.every((n) => new RegExp(`(^|\\D)${n}(\\D|$)`).test(source))
    if (!hasAll) {
      dropped.push(`años de experiencia: ${nums.join("–")}`)
      out.yearsExperience = undefined
    }
  }
  return { offer: out, dropped }
}

/** Concilia las listas del modelo con los bloques del texto (encabezados, contacto, hashtags). `reconcile: false` solo sirve para medir el antes y el después. */
const finish = (offer: Offer, input: string, reconcile: boolean) => tidyOffer(reconcile ? reconcileOffer(offer, input).offer : offer, input)

export async function parseOfferText(text: string, signal?: AbortSignal, opts: { reconcile?: boolean } = {}): Promise<OfferParseResult & { via: "lineas" | "json" }> {
  const reconcile = opts.reconcile ?? true
  const input = text.slice(0, OFFER_MAX_CHARS)
  // Camino rápido: el modelo etiqueta cada línea (≈ 50 tokens) y el resto se deriva sin IA. Si no es utilizable, JSON completo.
  try {
    const r = await labelOffer(input, signal)
    if (r.offer && r.meta) {
      const g = guardOffer(r.offer, input)
      return { data: finish(g.offer, input, reconcile), meta: { ...r.meta, ms: r.ms }, dropped: g.dropped, via: "lineas" }
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e
    if ((e as { code?: string }).code && ["unreachable", "not_configured", "model_missing", "timeout"].includes((e as { code: string }).code)) throw e
  }
  const { data, meta } = await getProvider().generateStructured<Offer>({
    system: OFFER_SYSTEM_PROMPT,
    user: `Texto de la oferta:\n"""\n${input}\n"""`,
    schema: offerSchema,
    signal,
  })
  const g = guardOffer(data, input)
  return { data: finish(g.offer, input, reconcile), meta, dropped: g.dropped, via: "json" }
}
