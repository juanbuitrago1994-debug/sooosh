import { clip } from "./text"

/**
 * Parte el texto de una oferta en requisitos, tareas y deseables a partir de sus títulos («Requisitos», «Responsabilidades», «Se valora»…)
 * y de sus viñetas. Determinista; si la oferta no tiene títulos ni viñetas, devuelve todo vacío (mejor nada que inventar).
 */
const REQ = /^(requisitos?|requirements?|qualifications?|lo que buscamos|qu[eé] buscamos|perfil|tu perfil|what we(?:'|’)re looking for|what you(?:'|’)ll bring|what you bring|must[- ]have|experiencia requerida|habilidades requeridas|conocimientos|skills)/i
const RESP = /^(responsabilidades|funciones|tus funciones|qu[eé] har[aá]s|tus tareas|tareas|what you(?:'|’)ll do|responsibilities|your role|the role|day[- ]to[- ]day|en este rol|retos|desaf[ií]os|qu[eé] desaf[ií]os)/i
const NICE = /^(deseable|se valora|valoramos|qu[eé] valoramos|nice to have|bonus|plus|a plus|preferred|ser[ií]a un plus|es un plus)/i
const OTHER = /^(beneficios|benefits|qu[eé] ofrecemos|what we offer|perks|sobre nosotros|about us|acerca de|about the company|nuestra empresa|proceso de selecci[oó]n|our hiring process)/i

type Kind = "req" | "resp" | "nice" | "other"
const kindOf = (line: string): Kind | null => {
  const t = line.replace(/[:：*#_]+/g, "").trim()
  if (t.length > 70 || /[.;]$/.test(line.trim()) || t.length < 4) return null
  if (NICE.test(t)) return "nice"
  if (REQ.test(t)) return "req"
  if (RESP.test(t)) return "resp"
  if (OTHER.test(t)) return "other"
  return null
}

export type Sections = { requirements: string[]; responsibilities: string[]; niceToHave: string[] }

export function splitSections(lines: string[], max = 12): Sections {
  const out: Sections = { requirements: [], responsibilities: [], niceToHave: [] }
  let cur: Kind | null = null
  for (const raw of lines) {
    const bullet = raw.startsWith("• ")
    const line = bullet ? raw.slice(2) : raw
    const k = bullet ? null : kindOf(line)
    if (k) {
      cur = k
      continue
    }
    if (!bullet || !cur || cur === "other") continue
    const target = cur === "req" ? out.requirements : cur === "resp" ? out.responsibilities : out.niceToHave
    if (target.length < max) target.push(clip(line))
  }
  return out
}

/** «5+ años», «entre 3 y 5 años», «3-5 years»: años de experiencia que piden los requisitos (solo si hay cifra explícita). */
export function yearsFrom(lines: string[]): { min?: number; max?: number } | undefined {
  for (const l of lines) {
    const range = l.match(/(\d{1,2})\s*(?:-|–|a|y|to)\s*(\d{1,2})\s*\+?\s*(?:años|anos|years|yrs)/i)
    if (range) return { min: Number(range[1]), max: Number(range[2]) }
    const one = l.match(/(?:m[ií]nimo\s*(?:de)?\s*|al menos\s*|more than\s*|m[aá]s de\s*)?(\d{1,2})\s*\+?\s*(?:años|anos|years|yrs)/i)
    if (one) return { min: Number(one[1]) }
  }
  return undefined
}
