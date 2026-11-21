import { plausibleCompany } from "./identity"

/**
 * Al copiar una publicación de LinkedIn desde el inicio suele venir pegado el ENCABEZADO: quién publica y hace cuánto («Vos Consultora / 34.982 seguidores /
 * 3 sem •»). Se separa del texto de la oferta. Si trae «seguidores» es una página de empresa: ese nombre es la empresa. Si es una persona
 * («Marta Quispe / Talent Acquisition en Initech / 3 sem •») solo se sabe quién publicó: no se inventa una empresa.
 */
const AGE = /^(?:\d+\s*(?:s|seg|min|h|d|sem|semanas?|mes(?:es)?|a|años?|w|mo|y|yr)|hace\s+\d+\s+\w+)\b.*$/i
const FOLLOWERS = /\b(?:seguidores|followers|seguidor)\b/i
const MAX_HEADER_LINES = 5

export function splitPostHeader(text: string): { text: string; company?: string; postedBy?: string } {
  const lines = text.split("\n")
  const idx = lines.findIndex((l) => l.trim())
  if (idx < 0) return { text }
  const head = lines.slice(idx, idx + MAX_HEADER_LINES)
  const ageAt = head.findIndex((l, i) => i > 0 && AGE.test(l.trim()))
  if (ageAt < 1) return { text }
  const name = head[0].trim()
  if (name.length > 70 || /[.!?:]$/.test(name) || name.split(/\s+/).length > 8) return { text }
  const rest = [...lines.slice(0, idx), ...lines.slice(idx + ageAt + 1)].join("\n").trim()
  const isPage = head.slice(1, ageAt).some((l) => FOLLOWERS.test(l))
  const empty = { requirements: [], niceToHave: [], responsibilities: [] }
  if (isPage && plausibleCompany(name, empty)) return { text: rest, company: name }
  return { text: rest, postedBy: name }
}
