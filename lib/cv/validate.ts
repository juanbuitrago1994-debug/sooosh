import type { CV } from "@/lib/schemas/cv"

/** Etapas de validación del CV leído (F1: nombre, rol y contacto; F2: resumen, habilidades e idiomas). Cada una se confirma con la persona antes de usar el dato. */
export const VALIDATION_STAGES = ["name", "role", "contact", "summary", "skills", "languages"] as const
export type ValidationStage = (typeof VALIDATION_STAGES)[number]

/**
 * Opciones de rol para el botón «Sugerir desde mi CV»: SOLO cargos que ya están escritos en el CV (el titular y los cargos de la experiencia),
 * sin repetir. No se inventa nada: si el CV no trae cargos, no hay sugerencias.
 */
export function roleSuggestions(cv: CV, max = 4): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of [cv.header.headline, ...cv.experience.map((e) => e.role)]) {
    const role = raw?.trim()
    const key = role?.toLowerCase()
    if (!role || !key || seen.has(key)) continue
    seen.add(key)
    out.push(role)
    if (out.length >= max) break
  }
  return out
}

/** El texto con el que se muestra cada dato (vacío si el CV no lo trae). */
export const contactParts = (cv: CV) => [cv.header.email, cv.header.phone, cv.header.location].map((v) => v?.trim() ?? "")

/** Habilidades del CV en una sola lista, sin repetir (se validan una por una). */
export function flatSkills(cv: CV): string[] {
  const seen = new Set<string>()
  return cv.skills.flatMap((g) => g.items).filter((i) => {
    const k = i.trim().toLowerCase()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Texto con el que se muestra cada dato de las etapas de F2. */
export const languagesText = (cv: CV) => cv.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(" · ")

export type StageValues = { name?: string; role?: string; email?: string; phone?: string; location?: string; summary?: string; skills?: string[]; languages?: { name: string; level?: string }[] }

/**
 * Devuelve el CV con el dato corregido; no toca nada más. Habilidades: se conservan los grupos del CV y solo se quitan las que la persona
 * descartó; las que agrega van en un grupo propio al final.
 */
export function applyStage(cv: CV, stage: ValidationStage, v: StageValues): CV {
  if (stage === "summary") return { ...cv, summary: v.summary?.trim() || undefined }
  if (stage === "skills") {
    const keep = new Set((v.skills ?? []).map((x) => x.trim().toLowerCase()))
    const seen = new Set<string>()
    const groups = cv.skills
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => {
          const k = i.trim().toLowerCase()
          if (!keep.has(k) || seen.has(k)) return false
          seen.add(k)
          return true
        }),
      }))
      .filter((g) => g.items.length > 0)
    const have = new Set(groups.flatMap((g) => g.items.map((i) => i.trim().toLowerCase())))
    const added = (v.skills ?? []).map((x) => x.trim()).filter((x) => x && !have.has(x.toLowerCase()))
    return { ...cv, skills: added.length ? [...groups, { items: [...new Set(added)] }] : groups }
  }
  if (stage === "languages") return { ...cv, languages: (v.languages ?? []).map((l) => ({ name: l.name.trim(), level: l.level?.trim() || undefined })).filter((l) => l.name) }
  const h = { ...cv.header }
  if (stage === "name" && v.name?.trim()) h.fullName = v.name.trim()
  if (stage === "role") h.headline = v.role?.trim() || undefined
  if (stage === "contact") {
    h.email = v.email?.trim() || undefined
    h.phone = v.phone?.trim() || undefined
    h.location = v.location?.trim() || undefined
  }
  return { ...cv, header: h }
}
