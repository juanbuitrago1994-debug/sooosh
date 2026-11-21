import type { CV } from "@/lib/schemas/cv"

/** Ajustes y hechos del cuerpo del correo: sin código de servidor, para poder usarlos también en el navegador. */
export const LENGTHS = ["corto", "medio", "largo"] as const
export const TONES = ["cercano", "profesional", "directo"] as const
export const FOCUSES = ["variado", "experiencia", "habilidades", "motivacion"] as const
export type BodySettings = { length: (typeof LENGTHS)[number]; tone: (typeof TONES)[number]; focus: (typeof FOCUSES)[number] }
export const DEFAULT_SETTINGS: BodySettings = { length: "medio", tone: "cercano", focus: "variado" }

export type CvFacts = { headline?: string; skills: string[]; roles: { role: string; company: string }[]; languages: string[] }
/** Hechos del CV que se le dan al modelo (lista cerrada y corta). */
export function cvFacts(cv: CV): CvFacts {
  return {
    headline: cv.header.headline?.trim() || undefined,
    skills: cv.skills.flatMap((g) => g.items).slice(0, 20),
    roles: cv.experience.slice(0, 3).map((e) => ({ role: e.role, company: e.company })),
    languages: cv.languages.map((l) => l.name).slice(0, 4),
  }
}

