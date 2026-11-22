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

/** Tono: una sola elección que fija cómo suena (registro, calidez y tipo de lenguaje juntos). La longitud, el idioma y lo demás se eligen aparte. */
export const TONES: { value: string; label: string; hint: string; settings: Pick<BodySettings, "register" | "warmth" | "style"> }[] = [
  { value: "cercano", label: "Cercano", hint: "Amable y natural, con palabras simples.", settings: { register: "cercano", warmth: "calida", style: "sencillo" } },
  { value: "profesional", label: "Profesional", hint: "Formal y claro, con el vocabulario de la oferta.", settings: { register: "profesional", warmth: "neutra", style: "tecnico" } },
  { value: "sobrio", label: "Sobrio", hint: "Formal y al grano, sin adornos.", settings: { register: "sobrio", warmth: "neutra", style: "sencillo" } },
]
/** Tono que coincide con los ajustes actuales (o `null` si la combinación no es de ninguno, p. ej. algo guardado con la versión anterior). */
export function toneOf(s: Pick<BodySettings, "register" | "warmth" | "style">): string | null {
  return TONES.find((t) => t.settings.register === s.register && t.settings.warmth === s.warmth && t.settings.style === s.style)?.value ?? null
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

