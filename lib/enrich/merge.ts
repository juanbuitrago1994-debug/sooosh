import type { Offer } from "@/lib/schemas/offer"

/**
 * Una oferta es «rica» si tiene al menos 2 elementos entre requisitos, deseables y tareas. Es más estricta que la regla de mostrar el encaje
 * (que también cuenta las herramientas): una oferta con solo herramientas sueltas todavía vale la pena estructurarla.
 */
export const isRich = (o: Offer): boolean => o.requirements.length + o.niceToHave.length + o.responsibilities.length >= 2

/** Texto mínimo del original para que valga la pena pedirle estructura a la IA. */
export const MIN_TEXT_CHARS = 200

/**
 * Mezcla lo que sacó la IA con la oferta que ya había. Reglas: **nunca se pisa lo que ya estaba bien** (una lista solo se llena si estaba
 * vacía), título y empresa no cambian, y las herramientas, idiomas y habilidades blandas se SUMAN sin repetir. Todo lo que trae la IA ya pasó
 * la guardia anti-invención (cada frase es una línea literal del texto original).
 */
export function mergeEnriched(current: Offer, extracted: Offer): { offer: Offer; added: number } {
  const fill = (a: string[], b: string[]) => (a.length === 0 ? b : a)
  const union = (a: string[] | undefined, b: string[] | undefined) => [...new Set([...(a ?? []), ...(b ?? [])])]
  const offer: Offer = {
    ...current,
    requirements: fill(current.requirements, extracted.requirements),
    niceToHave: fill(current.niceToHave, extracted.niceToHave),
    responsibilities: fill(current.responsibilities, extracted.responsibilities),
    tools: union(current.tools, extracted.tools).slice(0, 14),
    softSkills: union(current.softSkills, extracted.softSkills).slice(0, 8),
    yearsExperience: current.yearsExperience ?? extracted.yearsExperience,
    seniority: current.seniority && current.seniority !== "no-especificado" ? current.seniority : extracted.seniority,
    languagesRequired: current.languagesRequired?.length ? current.languagesRequired : extracted.languagesRequired,
  }
  const count = (o: Offer) => o.requirements.length + o.niceToHave.length + o.responsibilities.length
  return { offer, added: count(offer) - count(current) }
}
