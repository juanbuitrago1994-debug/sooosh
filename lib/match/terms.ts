import { contentKeys } from "@/lib/keywords/lexical"
import type { Offer } from "@/lib/schemas/offer"

/**
 * Términos de la oferta: salen del ESQUEMA ESTRUCTURADO (requisitos, deseables, herramientas, habilidades blandas,
 * funciones, idiomas), cada uno tal como lo dice la oferta. Nada de n-gramas ni palabras sueltas de oraciones:
 * así desaparecen términos basura como "shows", "fine" o "around".
 */
export type MatchKind = "requirement" | "niceToHave" | "tool" | "softSkill" | "responsibility" | "language"

export type OfferTerm = {
  id: string
  text: string
  kind: MatchKind
  /** obligatorio 3 · herramienta/idioma 2 · deseable 2 · habilidad blanda 1,5 · función 1 */
  weight: number
}

export const KIND_WEIGHT: Record<MatchKind, number> = { requirement: 3, tool: 2, language: 2, niceToHave: 2, softSkill: 1.5, responsibility: 1 }
export const KIND_LABEL: Record<MatchKind, string> = { requirement: "Requisito", niceToHave: "Se valora", tool: "Herramienta", softSkill: "Habilidad blanda", responsibility: "Función", language: "Idioma" }

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s•·\-–—*]+|[\s.;:]+$/g, "").trim()
const norm = (s: string) => contentKeys(s).join(" ") || s.toLowerCase()

export function buildTerms(offer: Offer): OfferTerm[] {
  const byKey = new Map<string, OfferTerm>()
  const add = (text: string, kind: MatchKind) => {
    const t = clean(text)
    if (t.length < 2 || t.length > 200) return
    const key = norm(t)
    const prev = byKey.get(key)
    const weight = KIND_WEIGHT[kind]
    // Si el mismo término aparece de varias formas ("SQL" como requisito y como herramienta), vale el de mayor peso.
    if (!prev || weight > prev.weight) byKey.set(key, { id: "", text: prev && prev.text.length >= t.length ? prev.text : t, kind, weight })
  }
  for (const r of offer.requirements) add(r, "requirement")
  for (const t of offer.tools ?? []) add(t, "tool")
  for (const l of offer.languagesRequired ?? []) add(l.level ? `${l.language} ${l.level}` : l.language, "language")
  for (const n of offer.niceToHave) add(n, "niceToHave")
  for (const s of offer.softSkills ?? []) add(s, "softSkill")
  for (const r of offer.responsibilities) add(r, "responsibility")
  return [...byKey.values()].map((t, i) => ({ ...t, id: `t${i}` }))
}

/**
 * Términos "cortos" que la reescritura NO puede introducir si el CV no los dice (guardia anti-invención):
 * herramientas, habilidades blandas y requisitos/deseables de hasta 4 palabras (partidos por "y", "o", comas).
 */
export function injectionTerms(offer: Offer): { term: string; key: string }[] {
  const out = new Map<string, { term: string; key: string }>()
  const add = (text: string) => {
    const t = clean(text)
    const key = contentKeys(t).join(" ")
    if (key && t.split(/\s+/).length <= 4) out.set(key, { term: t, key })
  }
  for (const t of offer.tools ?? []) add(t)
  for (const s of offer.softSkills ?? []) add(s)
  for (const item of [...offer.requirements, ...offer.niceToHave]) {
    if (clean(item).split(/\s+/).length <= 4) add(item)
    for (const piece of item.split(/\s*(?:,|;|\/|\by\b|\be\b|\bo\b|\band\b|\bor\b)\s*/i)) add(piece)
  }
  return [...out.values()]
}
