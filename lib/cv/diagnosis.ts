import { fold } from "@/lib/keywords/normalize"
import { existsInSource } from "@/lib/offer/guard"
import type { CV } from "@/lib/schemas/cv"
import type { Diagnosis } from "@/lib/schemas/diagnosis"
import type { Seniority } from "@/lib/schemas/offer"
import { totalYears } from "./dates"
import type { Section } from "./sections"

/** Diagnóstico DETERMINISTA (sin IA): idioma, secciones, estilo, años y seniority, problemas, riesgos ATS, confianza y pregunta. */
export type NameConfidence = "alta" | "media" | "baja"

const STOP_ES = new Set("de la el los las y en que con para por una un del al se su sus como más pero experiencia trabajo desarrollo empresa equipo proyectos años".split(" "))
const STOP_EN = new Set("the and of to in for with on at by an as is are was were team work experience project projects years developed managed led built".split(" "))

export function detectLanguage(text: string): { lang: Diagnosis["language"]; margin: number } {
  const words = fold(text).match(/[a-z]+/g) ?? []
  let es = 0
  let en = 0
  for (const w of words) {
    if (STOP_ES.has(w)) es++
    if (STOP_EN.has(w)) en++
  }
  const total = es + en
  if (total < 5) return { lang: "otro", margin: 0 }
  const margin = Math.abs(es - en) / total
  return { lang: es >= en ? "es" : "en", margin }
}

const GENERIC = [
  "responsable de", "encargado de", "encargada de", "a cargo de", "trabajo en equipo", "proactivo", "proactiva", "dinámico", "dinamica", "dinámica", "orientado a resultados", "orientada a resultados",
  "excelentes habilidades", "buena comunicación", "varias tareas", "diversas tareas", "tareas administrativas", "etc.", "y más", "multitarea",
  "responsible for", "in charge of", "team player", "results-oriented", "results oriented", "hard-working", "hardworking", "various tasks", "duties included", "excellent communication",
]
const METRIC = /\d|%|\b(duplic|tripl|millon|millón|mil)\b/i
const END = "(?=\\s|$|[.,;:])"
const FIRST_PRETERITE = new RegExp(`^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:é|í|je|ñé)${END}`)
const INFINITIVE = new RegExp(`^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:ar|er|ir)${END}`)
const EN_PAST = /^(?:[A-Z][a-z]+ed|Led|Built|Ran|Made|Drove|Wrote|Grew|Cut|Won|Sold|Led|Set|Spearheaded)\b/
const EN_GERUND = /^[A-Z][a-z]+ing\b/
const IMPERSONAL = /^(responsable|encargad|a cargo|participaci|manejo|gesti[oó]n|apoyo|soporte)/i

const words = (s: string) => s.split(/\s+/).filter(Boolean).length

export type Metrics = ReturnType<typeof computeStyle>

export function computeStyle(cv: CV, text: string, lang: Diagnosis["language"]) {
  const bullets = [...cv.experience.flatMap((e) => e.bullets), ...cv.projects.flatMap((p) => p.bullets)]
  const total = bullets.length
  const withMetrics = bullets.filter((b) => METRIC.test(b)).length
  let first = 0
  let infinitive = 0
  let impersonal = 0
  let past = 0
  let present = 0
  for (const b of bullets) {
    if (lang === "en") {
      if (EN_PAST.test(b)) past++
      else if (EN_GERUND.test(b)) impersonal++
      else present++
    } else if (FIRST_PRETERITE.test(b)) {
      first++
      past++
    } else if (INFINITIVE.test(b)) {
      infinitive++
    } else if (IMPERSONAL.test(b)) {
      impersonal++
    } else present++
  }
  const person: Diagnosis["style"]["person"] =
    total === 0 ? "impersonal" : first / total > 0.5 || (lang === "en" && past / total > 0.5) ? "primera" : (infinitive + impersonal) / total > 0.5 ? "impersonal" : present / total > 0.5 ? "tercera" : "mixta"
  const tenses: Diagnosis["style"]["tenses"] =
    total === 0 ? "mixto" : past / total > 0.5 ? "pasado" : infinitive / total > 0.5 ? "infinitivo" : present / total > 0.5 ? "presente" : "mixto"
  const informal = /[!¡]|\p{Extended_Pictographic}|\b(me encanta|apasionad|amo |soy un|i love|passionate)\b/iu.test(text)
  const tone: Diagnosis["style"]["tone"] = informal ? "cercano" : person === "primera" || person === "impersonal" ? "formal" : "neutro"

  const lines = text.split("\n").filter((l) => l.trim())
  const bulletLines = lines.filter((l) => /^\s*[-–—•·*▪◦►➢✓●○■□]\s+/.test(l)).length
  const longLines = lines.filter((l) => words(l) > 25).length
  const fmt: Diagnosis["style"]["bullets"] = bulletLines === 0 && longLines === 0 ? "sin-viñetas" : bulletLines === 0 ? "párrafos" : longLines > bulletLines ? "mixto" : "viñetas"
  const avg = total === 0 ? 0 : Math.round((bullets.reduce((n, b) => n + words(b), 0) / total) * 10) / 10
  return { tone, person, tenses, bullets: fmt, metrics: { bulletsTotal: total, bulletsWithMetrics: withMetrics, ratio: total ? Math.round((withMetrics / total) * 100) / 100 : 0 }, avgBulletWords: avg }
}

export function computeSeniority(cv: CV, now = new Date()): Diagnosis["seniority"] {
  const years = totalYears(cv.experience.map((e) => ({ start: e.startDate, end: e.endDate })), now)
  const titles = cv.experience.map((e) => fold(e.role)).join(" ")
  const byTitle: Seniority | null = /\b(director|gerente|head of|vp|cto|cio|ceo)\b/.test(titles)
    ? "directivo"
    : /\b(lead|lider|jefe|principal|staff|coordinador)\b/.test(titles)
      ? "lead"
      : /\b(senior|sr)\b/.test(titles) && !/semi/.test(titles)
        ? "senior"
        : /\b(semi[- ]?senior|ssr|mid)\b/.test(titles)
          ? "semi-senior"
          : /\b(practicante|pasante|trainee|intern|becari)/.test(titles)
            ? "practicante"
            : /\b(junior|jr)\b/.test(titles)
              ? "junior"
              : null
  if (years === null && !byTitle) return { label: "no-especificado", years: null, basis: "No hay fechas ni cargos que permitan estimarlo." }
  const byYears: Seniority | null = years === null ? null : years < 1 ? "practicante" : years < 2.5 ? "junior" : years < 5 ? "semi-senior" : "senior"
  const label = byTitle ?? byYears ?? "no-especificado"
  const basis = [years !== null ? `${years} años de experiencia sumando tus puestos` : "", byTitle ? `cargo «${cv.experience.find((e) => fold(e.role).match(/./))?.role}»` : ""].filter(Boolean).join(" · ")
  return { label, years, basis: basis || "Estimado por tus cargos." }
}

export function findProblems(cv: CV, sections: Section[], style: Metrics): Diagnosis["problems"] {
  const problems: Diagnosis["problems"] = []
  const bullets = [...cv.experience.flatMap((e) => e.bullets), ...cv.projects.flatMap((p) => p.bullets)]
  for (const g of GENERIC) {
    const hit = bullets.find((b) => fold(b).includes(fold(g)))
    if (hit) problems.push({ kind: "generico", text: `Frase genérica: «${g}». Di qué hiciste y con qué resultado.`, evidence: hit })
  }
  const generic = problems.slice(0, 3)
  const out: Diagnosis["problems"] = [...generic]
  if (style.metrics.bulletsTotal >= 3 && style.metrics.ratio < 0.3) {
    const ex = bullets.find((b) => !METRIC.test(b))
    out.push({ kind: "sin-cuantificar", text: `Solo ${style.metrics.bulletsWithMetrics} de ${style.metrics.bulletsTotal} viñetas tienen cifras o resultados medibles.`, evidence: ex })
  }
  const tiny = bullets.find((b) => words(b) < 4)
  const huge = bullets.find((b) => words(b) > 35)
  if (tiny) out.push({ kind: "relleno", text: "Hay viñetas demasiado cortas para aportar información.", evidence: tiny })
  if (huge) out.push({ kind: "relleno", text: "Hay viñetas muy largas (más de 35 palabras); conviene partirlas.", evidence: huge })
  const dup = bullets.find((b, i) => bullets.findIndex((c) => fold(c) === fold(b)) !== i)
  if (dup) out.push({ kind: "relleno", text: "Hay viñetas repetidas.", evidence: dup })
  if (!cv.summary?.trim()) out.push({ kind: "estructura", text: "No hay un resumen profesional al inicio." })
  if (!sections.some((s) => s.kind === "skills") && cv.skills.length === 0) out.push({ kind: "estructura", text: "No hay una sección de habilidades." })
  return out.slice(0, 6)
}

export function findAtsRisks(cv: CV, sections: Section[], text: string): string[] {
  const risks: string[] = []
  if (!cv.header.email) risks.push("No se encontró un correo electrónico.")
  if (!cv.header.phone) risks.push("No se encontró un teléfono.")
  if (cv.experience.length > 0 && cv.experience.some((e) => !e.startDate)) risks.push("Hay puestos sin fechas: los filtros de las empresas las usan.")
  const other = sections.filter((s) => s.kind === "other")
  if (other.length > 0) risks.push(`Encabezados poco estándar (${other.map((s) => `«${s.title}»`).join(", ")}) pueden no reconocerse.`)
  if (words(text) > 1100) risks.push("El CV es muy largo (más de 1100 palabras): lo ideal es 1–2 páginas.")
  if ((text.match(/\t| {4,}/g) ?? []).length > 12 || (text.match(/\|/g) ?? []).length > 8) risks.push("El texto parece venir de columnas o tablas, que algunos filtros leen mal.")
  if (cv.experience.length === 0) risks.push("No se detectó una sección de experiencia.")
  return risks
}

export function computeConfidence(args: { nameSource: "heuristica" | "modelo" | "ninguna"; cv: CV; lang: { lang: string; margin: number }; sections: Section[] }): Diagnosis["confidence"] {
  const { nameSource, cv, lang, sections } = args
  const jobsWithDates = cv.experience.filter((e) => e.startDate).length
  return {
    name: nameSource === "heuristica" ? "alta" : nameSource === "modelo" ? "media" : "baja",
    contact: cv.header.email && cv.header.phone ? "alta" : cv.header.email || cv.header.phone ? "media" : "baja",
    experience: jobsWithDates > 0 ? "alta" : cv.experience.length > 0 ? "media" : sections.some((s) => s.kind === "experience") ? "media" : "baja",
    education: cv.education.length > 0 ? "alta" : sections.some((s) => s.kind === "education") ? "media" : "baja",
    language: lang.lang === "otro" ? "baja" : lang.margin > 0.3 ? "alta" : "media",
  }
}

/** Como máximo UNA pregunta, por prioridad, y solo si un dato clave tiene confianza baja. */
export function pickQuestion(conf: Diagnosis["confidence"], text: string): Diagnosis["question"] {
  if (conf.name === "baja") return { id: "fullName", kind: "text", text: "No pudimos identificar tu nombre. ¿Cómo te llamas?" }
  if (conf.experience === "baja" && text.length > 600) {
    return { id: "experience", kind: "choice", text: "No encontramos puestos de trabajo con fechas. ¿Tu CV tiene experiencia laboral?", options: ["Sí, añadirla", "No, es mi primer empleo"] }
  }
  if (conf.language === "baja") return { id: "language", kind: "choice", text: "No pudimos saber el idioma de tu CV. ¿En cuál está?", options: ["Español", "Inglés"] }
  return null
}

/** Una fortaleza solo vale si cita un fragmento que existe en el CV fuente. */
export function guardStrengths(items: { text: string; evidence: string }[], source: string): Diagnosis["strengths"] {
  return items.filter((s) => s.text.trim() && s.evidence.trim().length >= 12 && existsInSource(s.evidence, source, 0.9).ok).slice(0, 4)
}
