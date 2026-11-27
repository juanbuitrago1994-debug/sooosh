import { fold } from "@/lib/keywords/normalize"
import { fullHeadline } from "@/lib/cv/headline"
import type { CV } from "@/lib/schemas/cv"
import type { AtsLang } from "./headings"

/**
 * Idioma del CV subido (decisión de Juan, 23-nov-2026: la versión ATS usa el mismo idioma que el original). Heurística por palabras
 * funcionales: sin IA, sin red y sin librerías. Si no es español ni inglés, se usa inglés y se avisa.
 */
const ES = new Set("de la el los las y en con para por un una del al que se su sus como es son fue más mas entre sobre desde hasta durante lider liderazgo desarrollo gestion equipo equipos proyecto proyectos empresa experiencia trabajo diseno responsable cargo implemente implementacion mejore reduje coordine".split(" "))
const EN = new Set("the and of in with for to a an at by on from as is are was were led built managed developed designed team teams project projects company experience work responsible improved reduced increased across using across through".split(" "))

export type LangDetection = { lang: AtsLang; detected: AtsLang | "otro"; scores: { es: number; en: number } }

function textOf(cv: CV): string {
  return [
    fullHeadline(cv.header),
    cv.summary,
    ...cv.experience.flatMap((e) => [e.role, ...e.bullets]),
    ...cv.education.flatMap((e) => [e.degree, e.field, ...e.details]),
    ...cv.projects.flatMap((p) => [p.description, ...p.bullets]),
    ...cv.skills.map((g) => g.category),
  ]
    .filter(Boolean)
    .join(" ")
}

export function detectLang(cv: CV): LangDetection {
  const words = fold(textOf(cv)).match(/[a-z]+/g) ?? []
  let es = 0
  let en = 0
  for (const w of words) {
    if (ES.has(w)) es++
    if (EN.has(w)) en++
  }
  const scores = { es, en }
  const top = Math.max(es, en)
  if (words.length < 6 || top < 2) return { lang: "es", detected: "otro", scores } // muy poco texto: no hay base para opinar
  if (es === en) return { lang: "es", detected: "otro", scores }
  const detected = es > en ? "es" : "en"
  // Si ninguna lista explica una parte razonable del texto, probablemente es otro idioma.
  if (top / words.length < 0.08 && words.length >= 40) return { lang: "en", detected: "otro", scores }
  return { lang: detected, detected, scores }
}
