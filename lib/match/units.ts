import type { CV } from "@/lib/schemas/cv"
import { fullHeadline } from "@/lib/cv/headline"

/** Fragmentos de evidencia del CV: lo único con lo que se puede respaldar algo. Cada uno sabe de qué sección viene. */
export type Unit = { id: string; text: string; section: "Titular" | "Resumen" | "Experiencia" | "Educación" | "Habilidades" | "Idiomas" | "Proyectos" }

const MAX_UNITS = 80

export function buildUnits(cv: CV): Unit[] {
  const out: Unit[] = []
  const add = (text: string | undefined, section: Unit["section"]) => {
    const t = text?.replace(/\s+/g, " ").trim()
    if (t && t.length >= 2) out.push({ id: `u${out.length}`, text: t, section })
  }
  add(fullHeadline(cv.header), "Titular")
  for (const s of (cv.summary ?? "").split(/(?<=[.!?])\s+/)) add(s, "Resumen")
  for (const e of cv.experience) {
    add(`${e.role} en ${e.company}`, "Experiencia")
    e.bullets.forEach((b) => add(b, "Experiencia"))
  }
  for (const e of cv.education) add([e.degree, e.field, e.institution].filter(Boolean).join(" · "), "Educación")
  for (const g of cv.skills) g.items.forEach((i) => add(i, "Habilidades"))
  for (const l of cv.languages) add(l.level ? `${l.name} ${l.level}` : l.name, "Idiomas")
  for (const p of cv.projects) {
    add([p.name, p.description].filter(Boolean).join(": "), "Proyectos")
    p.technologies.forEach((t) => add(t, "Proyectos"))
    p.bullets.forEach((b) => add(b, "Proyectos"))
  }
  return out.slice(0, MAX_UNITS)
}
