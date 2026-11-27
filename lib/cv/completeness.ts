import type { CV } from "@/lib/schemas/cv"

/**
 * Qué tan completo está el perfil de «Your resume»: lo que casi todo CV necesita, campo por campo. NO cuenta lo que no todos los perfiles necesitan (proyectos, certificaciones, voluntariado,
 * premios, publicaciones): faltar eso no es un pendiente. Cada pendiente trae el `target` (id del campo o de la sección en la pantalla) al que llevarlo.
 */
export type ChecklistItem = { id: string; label: string; done: boolean; target: string }

const has = (s?: string) => !!s?.trim() && s.trim() !== "Sin nombre"

/**
 * La lista va en el MISMO orden que la pantalla (de arriba hacia abajo), campo por campo: correo y teléfono cuentan por separado, y dentro de cada puesto o
 * estudio se piden sus datos clave (inicio y logros del puesto; título y fechas del estudio). Si una lista está vacía, el pendiente es la sección entera.
 */
export function profileChecklist(cv: Partial<CV>): ChecklistItem[] {
  const out: ChecklistItem[] = []
  const add = (id: string, label: string, done: boolean, target: string) => out.push({ id, label, done, target })
  const h = cv.header
  add("name", "Nombre", has(h?.fullName), "header.fullName")
  add("headline", "Título profesional", has(h?.headline), "header.headline")
  add("taglines", "Titulares", (h?.taglines ?? []).length > 0, "header.taglines")
  add("email", "Correo", has(h?.email), "header.email")
  add("phone", "Teléfono", has(h?.phone), "header.phone")
  add("location", "Ubicación", has(h?.location), "header.location")
  add("links", "Enlaces (LinkedIn, portafolio)", (h?.links ?? []).some((l) => has(l?.url)), "header-links")
  add("summary", "Resumen profesional", has(cv.summary), "summary")

  const exp = cv.experience ?? []
  if (exp.length === 0) add("experience", "Experiencia laboral", false, "experiencia")
  exp.forEach((e, i) => {
    const who = has(e.company) ? e.company : has(e.role) ? e.role : `puesto ${i + 1}`
    add(`experience.${i}.startDate`, `Fecha de inicio (${who})`, has(e.startDate), `experience.${i}.startDate`)
    add(`experience.${i}.bullets`, `Logros (${who})`, (e.bullets ?? []).some((b) => has(b)), `experience.${i}.bullets`)
  })

  const edu = cv.education ?? []
  if (edu.length === 0) add("education", "Educación", false, "educacion")
  edu.forEach((e, i) => {
    const who = has(e.institution) ? e.institution : `estudio ${i + 1}`
    add(`education.${i}.degree`, `Título (${who})`, has(e.degree), `education.${i}.degree`)
    add(`education.${i}.endDate`, `Fechas (${who})`, has(e.startDate) || has(e.endDate), `education.${i}.endDate`)
  })

  add("skills", "Habilidades", (cv.skills ?? []).length > 0, "habilidades")
  add("languages", "Idiomas", (cv.languages ?? []).length > 0, "idiomas")
  return out
}

export function completeness(cv: Partial<CV>): { done: number; total: number; percent: number; missing: ChecklistItem[] } {
  const items = profileChecklist(cv)
  const missing = items.filter((i) => !i.done)
  const done = items.length - missing.length
  return { done, total: items.length, percent: Math.round((done / items.length) * 100), missing }
}

/** El siguiente pendiente después del que se visitó por última vez (da la vuelta al final); sin pendientes, `null`. */
export function nextMissing(missing: ChecklistItem[], lastId?: string): ChecklistItem | null {
  if (missing.length === 0) return null
  const i = lastId ? missing.findIndex((m) => m.id === lastId) : -1
  return missing[(i + 1) % missing.length]
}
