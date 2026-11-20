import { z } from "zod"
import { fold } from "@/lib/keywords/normalize"
import type { Offer } from "@/lib/schemas/offer"
import { CASE_SENSITIVE, SKILLS, TAXONOMY_VERSION, type Skill, type SkillCategory } from "@/lib/taxonomy/skills"

/**
 * Perfil enriquecido de la oferta (Fase K2). Se construye SIN IA a partir de la oferta ya estructurada: separa lo obligatorio de lo
 * deseable y de lo que solo es contexto, lo técnico de lo transversal, normaliza cada habilidad contra la taxonomía local, y guarda
 * la frase EXACTA de la oferta (lo que leería un ATS) y la línea de origen. No añade nada que la oferta no diga.
 */
export const PROFILE_VERSION = 1

export const NECESSITY = ["obligatorio", "deseable", "contexto"] as const
export const TERM_CATEGORIES = ["herramienta", "tecnica", "transversal", "certificacion", "idioma", "educacion", "funcion", "dominio"] as const
export type Necessity = (typeof NECESSITY)[number]
export type TermCategory = (typeof TERM_CATEGORIES)[number]

export const profileTermSchema = z.object({
  id: z.string(),
  /** Habilidad normalizada (nombre canónico de la taxonomía) o, si no está en ella, el texto de la oferta. */
  label: z.string(),
  /** Id de la taxonomía; null si el término no está en ella (se compara luego por su texto). */
  canonical: z.string().nullable(),
  category: z.enum(TERM_CATEGORIES),
  necessity: z.enum(NECESSITY),
  /** Peso final (≥ 0,5): base por necesidad × énfasis × repetición. */
  weight: z.number(),
  /** Frase exacta de la oferta donde aparece (para citar y para escribir como un ATS la leería). */
  atsPhrase: z.string(),
  /** Alias con los que el CV puede nombrar lo mismo (taxonomía). */
  aliases: z.array(z.string()),
  /** Años exigidos para ESTA habilidad, si la línea los dice («3 años de experiencia en Python»). */
  years: z.number().nullable(),
  /** Veces que la oferta nombra el término. */
  mentions: z.number().int(),
})
export type ProfileTerm = z.infer<typeof profileTermSchema>

export const offerProfileSchema = z.object({
  version: z.number(),
  title: z.string(),
  /** Familia de rol: palabras clave del título sin nivel ("Analista de Datos Senior" → «analista de datos»). */
  role: z.string(),
  seniority: z.string().nullable(),
  years: z.object({ min: z.number().nullable(), max: z.number().nullable() }),
  terms: z.array(profileTermSchema),
  education: z.object({ level: z.enum(["ninguno", "tecnico", "grado", "posgrado"]), fields: z.array(z.string()), required: z.boolean(), phrase: z.string().nullable() }),
  certifications: z.array(z.string()),
  domains: z.array(z.string()),
})
export type OfferProfile = z.infer<typeof offerProfileSchema>

const BASE: Record<Necessity, number> = { obligatorio: 3, deseable: 2, contexto: 1 }
const CAT: Record<SkillCategory, TermCategory> = { tool: "herramienta", tech: "tecnica", soft: "transversal", cert: "certificacion", domain: "dominio" }
/** Énfasis explícito en la propia línea. */
const MUST = /\b(indispensable|imprescindible|excluyente|obligatori[oa]|must[- ]have|required|essential|mandatory|requerid[oa])\b/i
const NICE = /\b(deseable|se valora|valorable|plus|nice[- ]to[- ]have|preferred|preferible|ideal|a plus|bonus)\b/i

const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const wordRe = (alias: string, flags: string) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(alias)}(?![\\p{L}\\p{N}])`, flags)

type Alias = { skill: Skill; alias: string; re: RegExp; caseSensitive: boolean }
const ALIASES: Alias[] = SKILLS.flatMap((skill) =>
  skill.aliases
    .map((a) => fold(a))
    .filter((a) => a.length >= 2)
    .map((alias) => {
      const caseSensitive = CASE_SENSITIVE.has(skill.id)
      return { skill, alias, caseSensitive, re: caseSensitive ? wordRe(skill.label, "u") : wordRe(alias, "u") }
    }),
)

/** Habilidades de la taxonomía nombradas en un texto (una sola vez cada una, en orden de aparición). */
export function skillsIn(text: string): Skill[] {
  const folded = fold(text)
  const hits = new Map<string, { skill: Skill; at: number }>()
  for (const a of ALIASES) {
    const m = (a.caseSensitive ? text : folded).match(a.re)
    if (m && m.index !== undefined && (!hits.has(a.skill.id) || m.index < hits.get(a.skill.id)!.at)) hits.set(a.skill.id, { skill: a.skill, at: m.index })
  }
  return [...hits.values()].sort((x, y) => x.at - y.at).map((h) => h.skill)
}

const countMentions = (skill: Skill, folded: string, raw: string): number => {
  let n = 0
  for (const a of ALIASES) if (a.skill.id === skill.id) n = Math.max(n, ((a.caseSensitive ? raw : folded).match(new RegExp(a.re.source, "gu")) ?? []).length)
  return n
}

/** Habilidades de la taxonomía nombradas en un texto, con cuántas veces se mencionan. */
export function skillMentions(text: string): { skill: Skill; count: number }[] {
  const folded = fold(text)
  return skillsIn(text).map((skill) => ({ skill, count: countMentions(skill, folded, text) }))
}

const yearsForLine = (line: string): number | null => {
  const m = fold(line).match(/(\d{1,2})\s*\+?\s*(?:anos|years|yrs)\b/)
  return m ? Number(m[1]) : null
}

const EDU: { level: OfferProfile["education"]["level"]; re: RegExp }[] = [
  { level: "posgrado", re: /\b(maestria|master|msc|mba|doctorado|phd|posgrado|postgrado|especializacion)\b/ },
  { level: "grado", re: /\b(licenciatura|ingenieria|ingeniero|grado|bachelor|bachelors|universitari[oa]|profesional en|titulo|degree|pregrado)\b/ },
  { level: "tecnico", re: /\b(tecnico|tecnologo|technical degree|associate|diplomado|bachiller)\b/ },
]
const FIELDS = ["sistemas", "informatica", "computer science", "ciencias de la computacion", "ingenieria industrial", "administracion", "economia", "contabilidad", "finanzas", "estadistica", "matematicas", "marketing", "comunicacion", "diseno", "derecho", "psicologia", "ingenieria civil", "ingenieria electronica", "datos", "negocios", "business"]

export type EducationLevel = OfferProfile["education"]["level"]
export const EDU_RANK: Record<EducationLevel, number> = { ninguno: 0, tecnico: 1, grado: 2, posgrado: 3 }
/** Nivel educativo que nombra un texto («Maestría en Finanzas» → posgrado); «ninguno» si no se reconoce. */
export function educationLevelOf(text: string): EducationLevel {
  const f = fold(text)
  return EDU.find((e) => e.re.test(f))?.level ?? "ninguno"
}

function educationOf(lines: { text: string; necessity: Necessity }[]): OfferProfile["education"] {
  for (const l of lines) {
    const f = fold(l.text)
    const hit = EDU.find((e) => e.re.test(f))
    if (hit) return { level: hit.level, fields: FIELDS.filter((x) => f.includes(x)), required: l.necessity === "obligatorio", phrase: l.text }
  }
  return { level: "ninguno", fields: [], required: false, phrase: null }
}

const SENIORITY_IN_TITLE = /\b(sr|senior|ssr|semi[- ]?senior|jr|junior|lead|l[ií]der|principal|head|director|trainee|practicante)\b\.?/gi
const ROLE_STOP = new Set(["de", "del", "la", "el", "en", "y", "e", "para", "a", "of", "the", "and", "for", "con"])

/** «Analista de Datos Senior (Híbrido)» → «analista de datos». */
export function roleFamily(title: string): string {
  return title.replace(/\([^)]*\)/g, " ").replace(SENIORITY_IN_TITLE, " ").replace(/[|/,–—-].*$/, " ").replace(/\s+/g, " ").trim().toLowerCase().split(" ").filter((w, i, arr) => !(ROLE_STOP.has(w) && (i === 0 || i === arr.length - 1))).join(" ")
}

/** `rawText` (texto original de la oferta) es opcional: si se da, cuenta cuántas veces se nombra cada habilidad. */
export function buildOfferProfile(offer: Offer, rawText?: string): OfferProfile {
  const raw = rawText ?? ""
  const foldedRaw = fold(raw)
  const lines: { text: string; necessity: Necessity }[] = [
    ...offer.requirements.map((text) => ({ text, necessity: "obligatorio" as const })),
    ...offer.niceToHave.map((text) => ({ text, necessity: "deseable" as const })),
    ...offer.responsibilities.map((text) => ({ text, necessity: "contexto" as const })),
  ]
  const byId = new Map<string, ProfileTerm>()
  const addLine = (line: string, base: Necessity, forced?: Skill[]) => {
    // El énfasis de la propia línea puede subir o bajar la necesidad.
    const necessity: Necessity = NICE.test(line) ? "deseable" : MUST.test(line) && base !== "obligatorio" ? "obligatorio" : base
    const emphasis = MUST.test(line) ? 1.25 : 1
    const years = yearsForLine(line)
    for (const skill of forced ?? skillsIn(line)) {
      const mentions = raw ? Math.max(1, countMentions(skill, foldedRaw, raw)) : 1
      const weight = Math.round(BASE[necessity] * emphasis * (1 + Math.min(mentions - 1, 3) * 0.15) * 100) / 100
      const prev = byId.get(skill.id)
      if (prev && prev.weight >= weight) continue
      byId.set(skill.id, { id: skill.id, label: skill.label, canonical: skill.id, category: CAT[skill.category], necessity, weight, atsPhrase: line.trim(), aliases: skill.aliases, years, mentions })
    }
  }
  for (const l of lines) addLine(l.text, l.necessity)
  // Listas explícitas del esquema (herramientas, habilidades blandas): cuentan aunque la línea de origen no esté en requisitos.
  for (const t of offer.tools ?? []) addLine(t, "obligatorio", skillsIn(t))
  for (const t of offer.softSkills ?? []) addLine(t, "deseable", skillsIn(t))

  const terms: ProfileTerm[] = [...byId.values()]
  // Lo que la taxonomía no conoce se conserva con su texto (nunca se pierde un requisito).
  const known = new Set(terms.map((t) => fold(t.atsPhrase)))
  const unknown = (items: string[], necessity: Necessity, category: TermCategory) =>
    items.forEach((text, i) => {
      // El nivel educativo se evalúa aparte (perfil.education), no como un término técnico.
      if (known.has(fold(text)) || educationLevelOf(text) !== "ninguno") return
      terms.push({ id: `${category}-${necessity}-${i}`, label: text.trim(), canonical: null, category, necessity, weight: BASE[necessity] * (MUST.test(text) ? 1.25 : 1), atsPhrase: text.trim(), aliases: [], years: yearsForLine(text), mentions: 1 })
    })
  unknown(offer.requirements, "obligatorio", "tecnica")
  unknown(offer.niceToHave, "deseable", "tecnica")
  unknown(offer.responsibilities, "contexto", "funcion")
  for (const l of offer.languagesRequired ?? []) {
    terms.push({ id: `idioma-${fold(l.language)}`, label: l.level ? `${l.language} ${l.level}` : l.language, canonical: null, category: "idioma", necessity: "obligatorio", weight: 2.5, atsPhrase: l.level ? `${l.language} ${l.level}` : l.language, aliases: [], years: null, mentions: 1 })
  }
  terms.sort((a, b) => b.weight - a.weight)

  const text = [offer.title, ...lines.map((l) => l.text)].join("\n")
  return {
    version: PROFILE_VERSION * 1000 + TAXONOMY_VERSION,
    title: offer.title,
    role: roleFamily(offer.title),
    seniority: offer.seniority && offer.seniority !== "no-especificado" ? offer.seniority : null,
    years: { min: offer.yearsExperience?.min ?? null, max: offer.yearsExperience?.max ?? null },
    terms,
    education: educationOf(lines),
    certifications: skillsIn(text).filter((s) => s.category === "cert").map((s) => s.label),
    domains: skillsIn(`${raw}\n${text}`).filter((s) => s.category === "domain").map((s) => s.label),
  }
}
