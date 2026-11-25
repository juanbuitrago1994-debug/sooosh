import { fold } from "@/lib/keywords/normalize"
import type { Offer } from "@/lib/schemas/offer"

/**
 * Limpieza FINAL de una oferta ya estructurada (determinista, sin IA; todo sale del texto). Arregla lo que se vio al recorrer el asistente:
 *  - la «empresa» era un SECTOR o una descripción («Product Designer – Fintech», «una fintech en crecimiento»): se quita;
 *  - las listas traían rótulos pegados («Se valora: …»), el mismo texto dos veces y condiciones del contrato que no son del CV
 *    («Contrato indefinido, modalidad híbrida»): se quitan los rótulos, los duplicados y las condiciones;
 *  - los puntos finales hacían que, al unir frases, quedara «digitales..»: se quitan;
 *  - los deseables en una enumeración («banca o seguros, pruebas A/B, metodologías ágiles») se separan para cruzarlos uno a uno.
 */
const SECTOR = /^(fintech|healthtech|edtech|proptech|insurtech|legaltech|agritech|regtech|foodtech|retailtech|martech|adtech|startup|start-up|scaleup|scale-up|e-?commerce|saas|banca|banco|seguros|retail|tecnologia|consultoria|sector .+)$/

/** ¿Lo que el modelo llamó «empresa» es en realidad un sector o una descripción («una fintech»)? */
export function isSectorNotCompany(company: string, source: string): boolean {
  const c = fold(company).trim()
  if (!c) return false
  if (SECTOR.test(c)) return true
  // Descriptor: aparece en minúscula tras un artículo («somos una fintech en crecimiento»). «Únete a Nubank» (con mayúscula) sí es una empresa.
  const lower = company.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(?:^|[^\\p{L}])(?:una|un|an|the|a)\\s+${lower}(?![\\p{L}])`, "u").test(source)
}

const LABEL = /^(se valora(?:n)?|valoramos|deseable(?:s)?|nice to have|plus|sera un plus|se valorara)\s*[:\-–]\s*/i
const CONDITION = /^(contrato|tipo de contrato|modalidad|jornada|horario|salario|sueldo|remuneracion|ubicacion|lugar de trabajo|beneficios|contract|salary|location|schedule|working hours)\b/

const strip = (s: string) => s.replace(/\s+/g, " ").replace(/[\s.;:,]+$/, "").trim()

/** Parte una enumeración por comas fuera de paréntesis; solo si son varias y cortas. */
function splitList(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ""
  for (const ch of s) {
    if (ch === "(") depth++
    if (ch === ")") depth = Math.max(0, depth - 1)
    if (ch === "," && depth === 0) {
      parts.push(cur)
      cur = ""
    } else cur += ch
  }
  parts.push(cur)
  const items = parts.map(strip).filter(Boolean)
  return items.length >= 3 && items.every((p) => p.split(/\s+/).length <= 8) ? items : [strip(s)]
}

function tidyList(list: string[], split: boolean): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of list) {
    const noLabel = raw.replace(LABEL, "")
    if (CONDITION.test(fold(strip(noLabel)))) continue
    for (const item of split ? splitList(noLabel) : [strip(noLabel)]) {
      const key = fold(item)
      if (!item || seen.has(key) || CONDITION.test(key)) continue
      seen.add(key)
      out.push(item)
    }
  }
  return out
}

/** Años pedidos, si el modelo no los sacó: «3 o más años de experiencia…» en un requisito. Solo con una cifra explícita (nunca se estima). */
function yearsFrom(list: string[]): Offer["yearsExperience"] {
  for (const l of list) {
    const m = fold(l).match(/(?:^|[^\d])(\d{1,2})\s*(\+|o mas|ou mais)?\s*anos?\b/)
    if (m) return { min: Number(m[1]) }
  }
  return undefined
}

export function tidyOffer(offer: Offer, source: string): Offer {
  const requirements = tidyList(offer.requirements, false)
  return {
    ...offer,
    yearsExperience: offer.yearsExperience ?? yearsFrom(requirements),
    company: offer.company && !isSectorNotCompany(offer.company, source) ? offer.company : undefined,
    requirements,
    niceToHave: tidyList(offer.niceToHave, true),
    responsibilities: tidyList(offer.responsibilities, false),
  }
}
