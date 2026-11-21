import { fold } from "@/lib/keywords/normalize"
import type { Offer } from "@/lib/schemas/offer"

/**
 * Identidad de una oferta (cargo y empresa) con honestidad: lo que el modelo devuelve solo se acepta si PARECE un cargo / una empresa.
 * Una publicación de LinkedIn suele no traer título; entonces el modelo elige una línea de sección («🔹 Experiencia comprobable») o un requisito.
 * Todo es determinista y sale del texto: nada se inventa.
 *  - texto: el cargo está escrito como tal. inferido: se sacó de una frase tipo «Estamos seleccionando diseñadora UX/UI» (hay que confirmarlo).
 *  - falta: el texto no nombra el cargo (se deja vacío para escribirlo).
 */
export type TitleSource = "texto" | "inferido" | "falta"

// Rótulos fuertes: valen aunque sigan con más palabras («Requisitos mínimos», «Funciones del cargo»).
const STRONG = "requisitos?|requerimientos?|responsabilidades|funciones|ofrecemos|beneficios|que ofrecemos|que haras|sobre (?:nosotros|el cargo|el puesto|la empresa)|about (?:us|the role|the job)|requirements|responsibilities|benefits|nice to have|se valora|valorable|deseables?|postulacion|como (?:aplicar|postular)|what you.?ll do|what you bring|what we offer|qualifications|must have|how to apply|lo que buscamos"
// Rótulos débiles: solo cuentan si son TODA la línea. Con más palabras ya es un requisito («Experiencia con Power BI o Tableau»).
const WEAK = "perfil(?: del candidato| buscado)?|experiencia(?: comprobable| requerida| laboral)?|habilidades|conocimientos|formacion|educacion|idiomas|modalidad|ubicacion|horario|salario|actividades|tu rol|el rol|tus retos|the role|perks|contacto"
export const HEADING_RE = new RegExp(`^(?:(?:${STRONG})\\b|(?:${WEAK})$)`)

const symbols = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "").trim()
const wordsOf = (s: string) => s.replace(/[^\p{L}\p{N}\s/+#.-]/gu, " ").trim().split(/\s+/).filter(Boolean)

/** Encabezado de sección: termina en «:» o es un rótulo conocido («Requisitos», «🔹 Experiencia comprobable»), corto. */
export function isSectionHeading(line: string): boolean {
  const t = line.trim()
  const n = wordsOf(t).length
  if (n === 0 || n > 6) return false
  if (/[:：]$/.test(t)) return true
  return HEADING_RE.test(fold(symbols(t)).replace(/[:：]\s*$/, "").trim())
}

/** Encabezado «pelado»: sin contenido tras los dos puntos («Se valora:» sí, «Se valora: Python» no, porque ahí hay un dato). */
export function isBareHeading(line: string): boolean {
  return isSectionHeading(line) && !/[:：]\s*\S/.test(line.trim())
}

export const HOOK_START = /^(estamos\s+(seleccionando|buscando|contratando|reclutando)|buscamos|se\s+busca|se\s+necesita|necesitamos|requerimos|we(?:'re|\s+are)\s+(hiring|looking))/i
const HOOK =
  /(?:estamos\s+(?:seleccionando|buscando|contratando|reclutando)|buscamos|se\s+busca|se\s+necesita|necesitamos|requerimos|vacante\s+(?:de|para)|we(?:'re|\s+are)\s+(?:hiring|looking\s+for))\s*:?\s*(?:a\s+|una?\s+|el\s+|la\s+)?(.{3,80}?)(?=\s+(?:para|for|at|in|with|en|con|que|de\s+tiempo|a\s+tiempo|remot[oa]|h[ií]brid[oa]|presencial|y\s+(?:lo|la|el))\b|[.,;:!?\n(]|$)/i

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Cargo deducido de la frase de apertura («Estamos seleccionando diseñadora UX/UI para…» → «Diseñadora UX/UI»). */
export function titleFromHook(text: string): string | undefined {
  const m = text.slice(0, 800).match(HOOK)
  const t = m?.[1]?.trim().replace(/[\s,;]+$/, "")
  if (!t || wordsOf(t).length > 6 || isSectionHeading(t)) return undefined
  return capitalize(t)
}

/** ¿Parece un cargo? No lo es un encabezado, una frase de apertura, ni algo muy largo. */
export function plausibleTitle(title: string): boolean {
  const t = title.trim()
  if (!t || t.length > 100 || wordsOf(t).length > 12) return false
  return !isSectionHeading(t) && !HOOK_START.test(symbols(t))
}

const STOP = new Set(["de", "del", "la", "el", "los", "las", "e", "y", "en", "para", "con", "por", "un", "una", "of", "and", "the", "for", "to"])

/** ¿Parece el nombre de una empresa? No lo es una frase de requisito, un encabezado ni algo largo. */
export function plausibleCompany(company: string, offer: Pick<Offer, "requirements" | "niceToHave" | "responsibilities">): boolean {
  const c = company.trim()
  const words = wordsOf(c)
  if (!c || c.length > 60 || words.length === 0 || words.length > 6 || isSectionHeading(c)) return false
  const listed = [...offer.requirements, ...offer.niceToHave, ...offer.responsibilities].some((l) => fold(l).includes(fold(c)) && fold(l).length - fold(c).length < 12)
  if (listed) return false
  const stops = words.filter((w) => STOP.has(w.toLowerCase())).length
  const lowerStart = /^\p{Ll}/u.test(c)
  if (stops >= 3) return false
  // Una frase (con «¿?», punto final o minúscula inicial y varias palabras) no es el nombre de una empresa: «crecimiento. ¿Qué buscamos?» salía de partir una frase de apertura por «en».
  if (/[¿?!¡]/.test(c) || /[.]$/.test(c)) return false
  if (lowerStart && words.length > 1) return false
  return true
}

export function refineIdentity(offer: Offer, text: string): { title: string; titleSource: TitleSource; company?: string } {
  const company = offer.company && plausibleCompany(offer.company, offer) ? offer.company.trim() : undefined
  if (plausibleTitle(offer.title)) return { title: offer.title.trim(), titleSource: "texto", company }
  const hook = titleFromHook(text)
  return hook ? { title: hook, titleSource: "inferido", company } : { title: "", titleSource: "falta", company }
}
