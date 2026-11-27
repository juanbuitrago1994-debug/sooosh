import { z } from "zod"
import { fullHeadline } from "@/lib/cv/headline"
import { RANGE_RE, isOpen, parseDate, totalYears } from "@/lib/cv/dates"
import { fold } from "@/lib/keywords/normalize"
import type { CV } from "@/lib/schemas/cv"
import { EDU_RANK, educationLevelOf, type EducationLevel } from "./offer-profile"

/**
 * Perfil del CV por secciones (Fase K3). Todo se calcula SIN IA y de forma determinista a partir del CV ya estructurado; lo que se
 * señala lleva `evidence`: texto LITERAL del CV (así lo cualitativo que juzgue el modelo en K4 parte de hechos comprobables).
 * Es la entrada de los criterios de tipo «regla» de la rúbrica (docs/RUBRICA.md). Las heurísticas de lenguaje (verbos, clichés) son
 * aproximadas y están probadas en tests; ante la duda no penalizan.
 */
export const CV_PROFILE_VERSION = 1

const monthsOf = (d: { y: number; m: number }) => d.y * 12 + d.m
/** Fecha de fin: si solo trae el año («2018») se toma diciembre, no enero (si no, se inventarían 11 meses de hueco). */
function parseEnd(s: string): { y: number; m: number } | null {
  const d = parseDate(s)
  return d && /^\s*(?:19|20)\d{2}\s*$/.test(s) ? { y: d.y, m: 12 } : d
}

// ---------- viñetas ----------
const NUMBER = /(?<![\p{L}\p{N}])(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)(\s*(?:%|k\b|m\b|mm\b|mil\b|millones?\b|million\b|x\b))?/giu
const CURRENCY = /[$€£]\s*\d|\d\s*(?:usd|eur|cop|mxn|pen|clp|ars)\b/i
const YEAR_ONLY = /^(?:19|20)\d{2}$/

/** Cifras de una viñeta (porcentajes, montos, conteos). Los años («2021») y fechas NO cuentan como resultado medible. */
export function metricsIn(text: string): string[] {
  const clean = text.replace(RANGE_RE, " ")
  const out: string[] = []
  for (const m of clean.matchAll(NUMBER)) {
    const digits = m[1]
    if (YEAR_ONLY.test(digits)) continue
    out.push(m[0].trim())
  }
  if (out.length === 0 && CURRENCY.test(clean)) out.push(clean.match(CURRENCY)![0])
  return out
}

const TASK_START = /^(responsable|encargad|a cargo|funciones|tareas|apoyo|responsible|in charge|duties|tasked|worked on|helped|participe|participé|participaba|colabor[eé]|ayud)/i
const ACTION_ES = /(?:é|í|ó|aron|ieron|imos|amos)$/
const ACTION_EN = /(?:ed)$/
const ACTION_WORDS = new Set(
  `lidere lidero diseno disene desarrollo desarrolle implemente implemento gestione gestiono coordine coordino analice analizo cree creo mejore mejoro optimice optimizo
   automatice automatizo reduje redujo aumente aumento incremente incremento lance lanzo construi construyo dirigi dirijo negocie negocio logre logro cerre cierro
   estructure estructuro redacte redacto capacite capacito supervise superviso migre migro entregue entrego led built ran drove grew wrote made won cut set launched
   managed developed designed created improved increased reduced delivered owned shipped scaled`.split(/\s+/),
)

/** Primera palabra de la viñeta si es un verbo de acción (heurística es/en); null si es una tarea o no se reconoce. */
export function actionVerb(bullet: string): string | null {
  const first = bullet.trim().split(/\s+/)[0]?.replace(/[^\p{L}]/gu, "") ?? ""
  if (!first || TASK_START.test(bullet.trim())) return null
  const f = fold(first)
  if (ACTION_WORDS.has(f) || (first.length > 3 && (ACTION_ES.test(first.toLowerCase()) || ACTION_EN.test(f)))) return first
  return null
}

export const bulletSchema = z.object({
  /** Dónde está: «Experiencia #0», «Proyectos #1»… */
  where: z.string(),
  text: z.string(),
  words: z.number().int(),
  metrics: z.array(z.string()),
  verb: z.string().nullable(),
  /** Empieza como una tarea («Responsable de…»), no como un logro. */
  isTask: z.boolean(),
})
export type BulletInfo = z.infer<typeof bulletSchema>

// ---------- resumen ----------
const CLICHES: { re: RegExp }[] = [
  { re: /\bpersona\s+(?:proactiv[oa]|dinamic[oa]|responsable|comprometid[oa]|trabajador[a]?)\b/i },
  { re: /\b(?:proactiv[oa]|dinamic[oa]|apasionad[oa]|trabajador[a]?|comprometid[oa])\b/i },
  { re: /\borientad[oa]s?\s+a\s+(?:los\s+)?resultados\b/i },
  { re: /\b(?:team player|hard[- ]working|go[- ]getter|self[- ]motivated|results[- ]oriented|dynamic|passionate|motivated)\b/i },
]

export function clichesIn(text: string): string[] {
  const out: string[] = []
  for (const { re } of CLICHES) {
    const m = fold(text).match(re)
    if (!m || m.index === undefined) continue
    // La evidencia debe ser texto literal del original: se recupera con los mismos índices (fold no cambia la longitud).
    const lit = text.slice(m.index, m.index + m[0].length)
    if (!out.some((o) => fold(o).includes(fold(lit)) || fold(lit).includes(fold(o)))) out.push(lit)
  }
  return out
}

// ---------- perfil ----------
export const experienceInfoSchema = z.object({
  index: z.number().int(),
  role: z.string(),
  company: z.string(),
  start: z.string(),
  end: z.string().nullable(),
  /** Duración en meses (inclusiva); null si no se pudieron leer las fechas. */
  months: z.number().nullable(),
  current: z.boolean(),
  /** Años transcurridos desde que terminó (0 si es actual); null sin fechas. */
  endedYearsAgo: z.number().nullable(),
  bullets: z.number().int(),
})

export const cvProfileSchema = z.object({
  version: z.number(),
  contact: z.object({ name: z.boolean(), email: z.boolean(), phone: z.boolean(), location: z.boolean(), link: z.boolean(), missing: z.array(z.string()) }),
  headline: z.string().nullable(),
  summary: z.object({ text: z.string().nullable(), sentences: z.number().int(), words: z.number().int(), cliches: z.array(z.string()), mentionsYears: z.number().nullable() }),
  experience: z.array(experienceInfoSchema),
  /** Huecos de más de 6 meses entre puestos; `evidence` es la fecha de inicio (literal) del puesto que sigue al hueco. */
  gaps: z.array(z.object({ months: z.number(), after: z.string(), evidence: z.string() })),
  undatedPositions: z.array(z.number().int()),
  chronology: z.enum(["inversa", "directa", "mixta", "desconocida"]),
  totalYears: z.number().nullable(),
  bullets: z.object({
    total: z.number().int(),
    withMetrics: z.number().int(),
    metricRatio: z.number(),
    withActionVerb: z.number().int(),
    tasks: z.number().int(),
    avgWords: z.number(),
    long: z.number().int(),
    items: z.array(bulletSchema),
  }),
  skills: z.object({ groups: z.number().int(), items: z.array(z.string()), categorized: z.boolean(), inContext: z.array(z.string()), listOnly: z.array(z.string()) }),
  education: z.object({ entries: z.number().int(), highest: z.enum(["ninguno", "tecnico", "grado", "posgrado"]), undated: z.number().int() }),
  languages: z.array(z.string()),
  sections: z.object({ summary: z.boolean(), experience: z.boolean(), education: z.boolean(), skills: z.boolean(), languages: z.boolean(), projects: z.boolean() }),
  length: z.object({ words: z.number().int(), pagesEstimate: z.number() }),
})
export type CvProfile = z.infer<typeof cvProfileSchema>

const words = (t: string) => t.split(/\s+/).filter(Boolean).length
const inContextRe = (item: string) => new RegExp(`(?<![\\p{L}\\p{N}])${fold(item).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "u")

function chronologyOf(starts: number[]): CvProfile["chronology"] {
  if (starts.length < 2) return "desconocida"
  let desc = 0
  let asc = 0
  for (let i = 1; i < starts.length; i++) {
    if (starts[i] < starts[i - 1]) desc++
    else if (starts[i] > starts[i - 1]) asc++
  }
  return desc > 0 && asc === 0 ? "inversa" : asc > 0 && desc === 0 ? "directa" : desc === 0 && asc === 0 ? "desconocida" : "mixta"
}

export function buildCvProfile(cv: CV, now = new Date()): CvProfile {
  const nowM = now.getFullYear() * 12 + now.getMonth() + 1

  const exp = cv.experience.map((e, index) => {
    const a = parseDate(e.startDate)
    const current = !!e.endDate && isOpen(e.endDate)
    const b = !e.endDate ? null : current ? { y: now.getFullYear(), m: now.getMonth() + 1 } : parseEnd(e.endDate)
    const months = a && b && monthsOf(b) >= monthsOf(a) ? monthsOf(b) - monthsOf(a) + 1 : null
    return { index, e, a, b, current, months, endedYearsAgo: b ? Math.max(0, Math.round(((nowM - monthsOf(b)) / 12) * 10) / 10) : null }
  })

  // huecos entre puestos, en orden cronológico
  const dated = exp.filter((x) => x.a && x.b).sort((p, q) => monthsOf(p.a!) - monthsOf(q.a!))
  const gaps: CvProfile["gaps"] = []
  let reach = dated.length ? monthsOf(dated[0].b!) : 0
  for (const x of dated.slice(1)) {
    const gap = monthsOf(x.a!) - reach - 1
    if (gap > 6) gaps.push({ months: gap, after: dated.find((d) => monthsOf(d.b!) === reach)?.e.company ?? "", evidence: x.e.startDate })
    reach = Math.max(reach, monthsOf(x.b!))
  }

  // viñetas (experiencia y proyectos)
  const items: BulletInfo[] = []
  const addBullet = (where: string, text: string) => {
    const isTask = TASK_START.test(text.trim())
    items.push({ where, text, words: words(text), metrics: metricsIn(text), verb: actionVerb(text), isTask })
  }
  cv.experience.forEach((e, i) => e.bullets.forEach((b) => addBullet(`Experiencia #${i}`, b)))
  cv.projects.forEach((p, i) => p.bullets.forEach((b) => addBullet(`Proyectos #${i}`, b)))
  const withMetrics = items.filter((b) => b.metrics.length > 0).length

  // habilidades: ¿también aparecen dentro de un logro/responsabilidad/resumen?
  const skillItems = [...new Set(cv.skills.flatMap((g) => g.items).map((s) => s.trim()).filter(Boolean))]
  const prose = fold([cv.summary ?? "", ...items.map((b) => b.text), ...cv.projects.map((p) => p.description ?? "")].join("\n"))
  const inContext = skillItems.filter((s) => s.split(/\s+/).length <= 4 && inContextRe(s).test(prose))

  const summaryText = cv.summary?.trim() || null
  const yearsMention = summaryText ? fold(summaryText).match(/(\d{1,2})\s*\+?\s*(?:anos|years)/)?.[1] : undefined
  const eduLevels = cv.education.map((e) => educationLevelOf([e.degree, e.field].filter(Boolean).join(" ")))
  const highest = eduLevels.reduce<EducationLevel>((best, l) => (EDU_RANK[l] > EDU_RANK[best] ? l : best), "ninguno")

  const allText = [cv.header.fullName, fullHeadline(cv.header), cv.summary, ...cv.experience.flatMap((e) => [e.role, e.company, ...e.bullets]), ...cv.education.flatMap((e) => [e.institution, e.degree, e.field, ...e.details]), ...cv.skills.flatMap((g) => g.items), ...cv.projects.flatMap((p) => [p.name, p.description, ...p.bullets])].filter(Boolean).join(" ")
  const wc = words(allText)

  const contact = { name: !!cv.header.fullName?.trim(), email: !!cv.header.email, phone: !!cv.header.phone, location: !!cv.header.location, link: cv.header.links.length > 0 }
  const missing = [!contact.name && "nombre", !contact.email && "correo", !contact.phone && !contact.link && "teléfono o enlace profesional"].filter((x): x is string => !!x)

  return {
    version: CV_PROFILE_VERSION,
    contact: { ...contact, missing },
    headline: cv.header.headline?.trim() || null,
    summary: { text: summaryText, sentences: summaryText ? summaryText.split(/(?<=[.!?])\s+/).filter(Boolean).length : 0, words: summaryText ? words(summaryText) : 0, cliches: summaryText ? clichesIn(summaryText) : [], mentionsYears: yearsMention ? Number(yearsMention) : null },
    experience: exp.map((x) => ({ index: x.index, role: x.e.role, company: x.e.company, start: x.e.startDate, end: x.e.endDate?.trim() || null, months: x.months, current: x.current, endedYearsAgo: x.endedYearsAgo, bullets: x.e.bullets.length })),
    gaps,
    undatedPositions: exp.filter((x) => !x.a).map((x) => x.index),
    chronology: chronologyOf(exp.filter((x) => x.a).map((x) => monthsOf(x.a!))),
    totalYears: totalYears(cv.experience.map((e) => ({ start: e.startDate, end: e.endDate })), now),
    bullets: {
      total: items.length,
      withMetrics,
      metricRatio: items.length ? Math.round((withMetrics / items.length) * 100) / 100 : 0,
      withActionVerb: items.filter((b) => b.verb !== null).length,
      tasks: items.filter((b) => b.isTask).length,
      avgWords: items.length ? Math.round((items.reduce((a, b) => a + b.words, 0) / items.length) * 10) / 10 : 0,
      long: items.filter((b) => b.words > 35).length,
      items,
    },
    skills: { groups: cv.skills.length, items: skillItems, categorized: cv.skills.length > 0 && cv.skills.every((g) => !!g.category), inContext, listOnly: skillItems.filter((s) => !inContext.includes(s)) },
    education: { entries: cv.education.length, highest, undated: cv.education.filter((e) => !e.startDate && !e.endDate).length },
    languages: cv.languages.map((l) => (l.level ? `${l.name} ${l.level}` : l.name)),
    sections: { summary: !!summaryText, experience: cv.experience.length > 0, education: cv.education.length > 0, skills: skillItems.length > 0, languages: cv.languages.length > 0, projects: cv.projects.length > 0 },
    length: { words: wc, pagesEstimate: Math.round((wc / 500) * 2) / 2 },
  }
}
