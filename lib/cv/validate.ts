import type { CV } from "@/lib/schemas/cv"

/** Etapas de validación del CV leído. Cada una se confirma con la persona antes de usar el dato. */
export type StageKind = "name" | "role" | "contact" | "summary" | "experience" | "education" | "skills" | "languages"
/** `idx` solo cuenta en experiencia y estudios: cuál de las entradas del CV es. */
export type Stage = { kind: StageKind; idx?: number }

/** Las etapas para un CV: lo básico, el resumen, CADA experiencia, CADA estudio, las habilidades y los idiomas. */
export function stagesFor(cv: CV): Stage[] {
  return [
    { kind: "name" },
    { kind: "role" },
    { kind: "contact" },
    { kind: "summary" },
    ...cv.experience.map((_, idx): Stage => ({ kind: "experience", idx })),
    ...cv.education.map((_, idx): Stage => ({ kind: "education", idx })),
    { kind: "skills" },
    { kind: "languages" },
  ]
}

/** Al quitar una experiencia o estudio, las etapas siguientes del mismo tipo bajan un lugar. */
export function dropStage(stages: Stage[], at: number): Stage[] {
  const gone = stages[at]
  return stages.flatMap((s, i) => (i === at ? [] : s.kind === gone.kind && s.idx != null && gone.idx != null && s.idx > gone.idx ? [{ ...s, idx: s.idx - 1 }] : [s]))
}

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

export type ExperienceValues = { role: string; company: string; location?: string; startDate: string; endDate?: string; bullets: string[] }
export type EducationValues = { institution: string; degree?: string; field?: string; startDate?: string; endDate?: string }
export type StageValues = { name?: string; role?: string; email?: string; phone?: string; location?: string; summary?: string; skills?: string[]; languages?: { name: string; level?: string }[]; experience?: ExperienceValues; education?: EducationValues }

/**
 * Devuelve el CV con el dato corregido; no toca nada más. Habilidades: se conservan los grupos del CV y solo se quitan las que la persona
 * descartó; las que agrega van en un grupo propio al final.
 */
export function applyStage(cv: CV, stage: Stage, v: StageValues): CV {
  const kind = stage.kind
  if (kind === "experience" && v.experience && stage.idx != null) {
    const e = v.experience
    const prev = cv.experience[stage.idx]
    if (!prev || !e.role.trim() || !e.company.trim()) return cv
    const next = { ...prev, role: e.role.trim(), company: e.company.trim(), location: e.location?.trim() || undefined, startDate: e.startDate.trim(), endDate: e.endDate?.trim() || undefined, bullets: e.bullets.map((b) => b.trim()).filter(Boolean) }
    return { ...cv, experience: cv.experience.map((x, i) => (i === stage.idx ? next : x)) }
  }
  if (kind === "education" && v.education && stage.idx != null) {
    const e = v.education
    const prev = cv.education[stage.idx]
    if (!prev || !e.institution.trim()) return cv
    const next = { ...prev, institution: e.institution.trim(), degree: e.degree?.trim() || undefined, field: e.field?.trim() || undefined, startDate: e.startDate?.trim() || undefined, endDate: e.endDate?.trim() || undefined }
    return { ...cv, education: cv.education.map((x, i) => (i === stage.idx ? next : x)) }
  }
  if (kind === "summary") return { ...cv, summary: v.summary?.trim() || undefined }
  if (kind === "skills") {
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
  if (kind === "languages") return { ...cv, languages: (v.languages ?? []).map((l) => ({ name: l.name.trim(), level: l.level?.trim() || undefined })).filter((l) => l.name) }
  const h = { ...cv.header }
  if (kind === "name" && v.name?.trim()) h.fullName = v.name.trim()
  if (kind === "role") h.headline = v.role?.trim() || undefined
  if (kind === "contact") {
    h.email = v.email?.trim() || undefined
    h.phone = v.phone?.trim() || undefined
    h.location = v.location?.trim() || undefined
  }
  return { ...cv, header: h }
}

/** Quita una experiencia o un estudio del CV (la persona dice que no es suyo o que está de más). */
export function removeEntry(cv: CV, stage: Stage): CV {
  if (stage.idx == null) return cv
  if (stage.kind === "experience") return { ...cv, experience: cv.experience.filter((_, i) => i !== stage.idx) }
  if (stage.kind === "education") return { ...cv, education: cv.education.filter((_, i) => i !== stage.idx) }
  return cv
}

const range = (a?: string, b?: string) => [a?.trim(), b?.trim()].filter(Boolean).join(" – ")
/** Línea de resumen de una experiencia o un estudio, para mostrarla y confirmarla. */
export function entryLine(cv: CV, s: Stage): string {
  if (s.kind === "experience" && s.idx != null) {
    const e = cv.experience[s.idx]
    return e ? [e.role, e.company, range(e.startDate, e.endDate)].filter(Boolean).join(" · ") : ""
  }
  if (s.kind === "education" && s.idx != null) {
    const e = cv.education[s.idx]
    return e ? [[e.degree, e.field].filter(Boolean).join(", "), e.institution, range(e.startDate, e.endDate)].filter(Boolean).join(" · ") : ""
  }
  return ""
}
