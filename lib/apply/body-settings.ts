import type { CV } from "@/lib/schemas/cv"

/** Ajustes y hechos del cuerpo del correo: sin código de servidor, para poder usarlos también en el navegador. */
export const LENGTHS = ["minimo", "corto", "medio", "largo"] as const
/** Registro: qué tan formal suena (siempre de tú). */
export const REGISTERS = ["sobrio", "profesional", "cercano", "casual"] as const
export const WARMTHS = ["neutra", "calida", "entusiasta"] as const
/** Tipo de lenguaje: palabras simples, vocabulario técnico de la oferta, o con hilo narrativo. */
export const STYLES = ["sencillo", "tecnico", "narrativo"] as const
export const LANGS = ["auto", "es", "en"] as const
export const FOCUSES = ["variado", "experiencia", "habilidades", "motivacion"] as const
export const GREETINGS = ["equipo", "formal", "simple"] as const
export const CTAS = ["conversar", "entrevista", "agradecer", "ninguno"] as const

export type BodySettings = {
  length: (typeof LENGTHS)[number]
  register: (typeof REGISTERS)[number]
  warmth: (typeof WARMTHS)[number]
  style: (typeof STYLES)[number]
  lang: (typeof LANGS)[number]
  focus: (typeof FOCUSES)[number]
  greeting: (typeof GREETINGS)[number]
  cta: (typeof CTAS)[number]
}
export const DEFAULT_SETTINGS: BodySettings = { length: "medio", register: "cercano", warmth: "calida", style: "sencillo", lang: "auto", focus: "variado", greeting: "equipo", cta: "conversar" }

/** Idioma real del correo: el elegido, o (en «automático») el de la oferta. */
export type Lang = "es" | "en"
export function resolveLang(setting: BodySettings["lang"], offerLanguage?: string | null): Lang {
  return setting === "en" || (setting === "auto" && offerLanguage === "en") ? "en" : "es"
}

/** Valores listos para una situación típica; la persona los ajusta después. */
export const PRESETS: { value: string; label: string; settings: Partial<BodySettings> }[] = [
  { value: "cercano", label: "Cercano y breve", settings: { register: "cercano", warmth: "calida", style: "sencillo", length: "corto", greeting: "equipo", cta: "conversar", focus: "variado" } },
  { value: "profesional", label: "Profesional", settings: { register: "profesional", warmth: "neutra", style: "tecnico", length: "medio", greeting: "formal", cta: "entrevista", focus: "experiencia" } },
  { value: "directo", label: "Directo", settings: { register: "sobrio", warmth: "neutra", style: "sencillo", length: "minimo", greeting: "simple", cta: "ninguno", focus: "habilidades" } },
]
/** Preset cuyos valores coinciden con los ajustes actuales (o `null` si la persona los personalizó). */
export function presetOf(s: BodySettings): string | null {
  return PRESETS.find((p) => (Object.keys(p.settings) as (keyof BodySettings)[]).every((k) => s[k] === p.settings[k]))?.value ?? null
}

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

