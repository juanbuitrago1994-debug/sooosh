import { contentKeys, termsIn } from "@/lib/keywords"
import { buildTerms } from "@/lib/match/terms"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"

/**
 * Adapta un CV a una oferta SIN inventar nada: solo cambia el ORDEN de lo que ya dice. Las habilidades (y sus grupos) que la oferta nombra pasan
 * adelante y, dentro de cada experiencia, los logros más relevantes para la oferta suben primero. No se quita, se agrega ni se reescribe nada, y
 * las experiencias siguen en orden cronológico inverso (lo que piden los ATS). Es estable: lo que empata conserva su orden original.
 */
export type TailorReport = { skillsMoved: number; bulletsMoved: number }

export function tailorCv(cv: CV, offer: Offer): { cv: CV; report: TailorReport } {
  const terms = buildTerms(offer)
    .map((t) => ({ key: contentKeys(t.text).join(" "), weight: t.weight }))
    .filter((t) => t.key)
  const score = (text: string) => termsIn(text, terms).reduce((n, t) => n + t.weight, 0)

  /** Orden estable por puntaje descendente; devuelve la lista y cuántos elementos cambiaron de lugar. */
  const rank = <T>(list: T[], textOf: (x: T) => string): { list: T[]; moved: number } => {
    const scored = list.map((x, i) => ({ x, i, s: score(textOf(x)) }))
    scored.sort((a, b) => b.s - a.s || a.i - b.i)
    return { list: scored.map((e) => e.x), moved: scored.filter((e, pos) => e.i !== pos).length }
  }

  let skillsMoved = 0
  let bulletsMoved = 0

  const groups = cv.skills.map((g) => {
    const r = rank(g.items, (x) => x)
    skillsMoved += r.moved
    return { ...g, items: r.list }
  })
  const g = rank(groups, (grp) => grp.items.join(" "))
  skillsMoved += g.moved

  const experience = cv.experience.map((e) => {
    const r = rank(e.bullets, (b) => b)
    bulletsMoved += r.moved
    return { ...e, bullets: r.list }
  })

  return { cv: { ...cv, skills: g.list, experience }, report: { skillsMoved, bulletsMoved } }
}
