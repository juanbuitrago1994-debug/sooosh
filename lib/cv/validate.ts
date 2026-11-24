import type { CV } from "@/lib/schemas/cv"

/** Etapas de validación del CV leído (F1: lo básico). Cada una se confirma con la persona antes de usar el dato. */
export const VALIDATION_STAGES = ["name", "role", "contact"] as const
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

/** Devuelve el CV con el dato corregido; no toca nada más. */
export function applyStage(cv: CV, stage: ValidationStage, v: { name?: string; role?: string; email?: string; phone?: string; location?: string }): CV {
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
