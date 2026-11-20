import { z } from "zod"
import { detectLanguage } from "@/lib/cv/diagnosis"
import { SYNONYM_GROUPS } from "@/lib/keywords/synonyms"
import { fold } from "@/lib/keywords/normalize"
import { offerSchema, type Offer } from "@/lib/schemas/offer"
import { getProvider } from "./index"

/**
 * Estructuración RÁPIDA de la oferta: el modelo solo indica QUÉ LÍNEAS son el título, la empresa, los requisitos, los deseables
 * y las funciones (números de línea: ≈ 50 tokens de salida en vez de ~180 de JSON); el resto (herramientas, habilidades blandas,
 * idiomas, seniority, años) se deriva sin IA del propio texto. Cada ítem es una línea literal de la oferta: no puede inventar nada.
 * (Un primer diseño pedía una etiqueta por línea, pero el modelo se equivocaba al contar: se medía 10 etiquetas para 13 líneas.)
 */
const idx = z.number().int().min(0)
export const indicesSchema = z.object({
  title: idx,
  company: idx.nullish(),
  requirements: z.array(idx),
  niceToHave: z.array(idx),
  responsibilities: z.array(idx),
})
export type LineIndices = z.infer<typeof indicesSchema>

export const LABEL_PROMPT = `Recibes las líneas numeradas de una oferta de trabajo. Devuelve los NÚMEROS de línea de cada parte:
{"title": línea del título del puesto, "company": línea con el nombre de la empresa (o null), "requirements": [líneas de requisitos obligatorios], "niceToHave": [líneas de lo deseable o que "se valora"], "responsibilities": [líneas de funciones o responsabilidades]}
No incluyas encabezados como «Requisitos:» o «Responsabilidades:», ni beneficios, ni cómo postular, ni hashtags. Una línea con varias cosas va en la parte principal. Responde únicamente con el JSON.`

const strip = (l: string) => l.replace(/^\s*(?:[-–—•·*▪◦►✓●○■□>]|\d{1,2}[.)])\s+/, "").replace(/\s+/g, " ").trim()

/** «Estamos contratando: Analista de Datos en Initech (híbrido, Lima).» → { title, company } */
export function splitTitleLine(line: string): { title: string; company?: string } {
  let t = strip(line).replace(/[.]+$/, "")
  const colon = t.indexOf(":")
  if (colon > 0 && t.slice(0, colon).split(/\s+/).length <= 5) t = t.slice(colon + 1).trim()
  t = t.replace(/\s*\([^)]*\)\s*$/, "").trim()
  const m = t.match(/^(.+?)\s+(?:en|at|@|—|–|-|\|)\s+(.+)$/i)
  return m ? { title: m[1].trim(), company: m[2].trim() } : { title: t }
}

const LANGS = ["inglés", "ingles", "english", "español", "spanish", "francés", "frances", "french", "alemán", "aleman", "german", "portugués", "portugues", "portuguese", "italiano", "chino", "mandarín"]
const CEFR = /\b[ABC][12]\b/
const LEVEL = /\b([ABC][12])\b|\b(básico|basico|intermedio|avanzado|fluido|nativo|bilingüe|bilingue|basic|intermediate|advanced|fluent|native)\b/i

export function languagesIn(lines: string[]): Offer["languagesRequired"] {
  const out: NonNullable<Offer["languagesRequired"]> = []
  for (const l of lines) {
    for (const lang of LANGS) {
      const i = fold(l).indexOf(lang)
      if (i < 0) continue
      const name = l.slice(i, i + lang.length)
      const after = l.slice(i + lang.length, i + lang.length + 30)
      const level = after.match(CEFR)?.[0] ?? after.match(LEVEL)?.[0]
      if (!out.some((o) => fold(o.language) === lang)) out.push({ language: name[0].toUpperCase() + name.slice(1), ...(level ? { level } : {}) })
    }
  }
  return out
}

const SOFT = SYNONYM_GROUPS.flat().filter((s) => /comunicaci|liderazgo|leadership|communication|trabajo en equipo|teamwork|resolución|problem solving|colabora|proactiv|adaptab|organizaci|creatividad|empat/i.test(s))
export function softSkillsIn(text: string): string[] {
  const f = fold(text)
  return [...new Set(SOFT.filter((s) => f.includes(fold(s))))].slice(0, 8)
}

const NOT_TOOL = new Set(["inglés", "español", "requisitos", "se", "experiencia", "conocimientos", "dominio", "estudios", "responsabilidades", "ofrecemos", "envía", "buscamos"])
/** Herramientas/tecnologías: secuencias de palabras con mayúscula o siglas que NO abren la línea. */
export function toolsIn(lines: string[]): string[] {
  const out = new Set<string>()
  for (const raw of lines) {
    const words = strip(raw).split(/\s+/)
    let run: string[] = []
    let startsAtLineStart = false
    const flush = () => {
      // La primera palabra de la línea suele ser solo mayúscula inicial ("Dominio de…"): solo cuenta si forma secuencia ("Power BI").
      if (run.length && !(startsAtLineStart && run.length === 1)) out.add(run.join(" ").replace(/[.,;:)]+$/, ""))
      run = []
      startsAtLineStart = false
    }
    words.forEach((w, i) => {
      const clean = w.replace(/[.,;:()]+$/g, "")
      const tech = /^(?:[A-Z][\w+#./-]*|[A-Z]{2,}|\w+\.js|\w*[+#]+)$/.test(clean) && !NOT_TOOL.has(fold(clean)) && clean.length > 1
      if (tech) {
        if (run.length === 0) startsAtLineStart = i === 0
        run.push(clean)
      } else flush()
    })
    flush()
  }
  return [...out].filter((t) => !LANGS.includes(fold(t))).slice(0, 14)
}

const SENIORITY: [RegExp, NonNullable<Offer["seniority"]>][] = [
  [/practicante|pasante|trainee|intern(ship)?/i, "practicante"],
  [/semi[- ]?senior|\bssr\b/i, "semi-senior"],
  [/(?<!semi[- ]?)\bsenior\b|\bsr\.?\b/i, "senior"],
  [/\bjunior\b|\bjr\b/i, "junior"],
  [/\blead\b|l[ií]der|\bhead\b|principal|jefe/i, "lead"],
  [/director|gerente|\bvp\b/i, "directivo"],
]
export function seniorityIn(text: string): Offer["seniority"] {
  return SENIORITY.find(([re]) => re.test(fold(text)))?.[1]
}
export function yearsIn(text: string): Offer["yearsExperience"] {
  const range = text.match(/(\d{1,2})\s*(?:a|-|–|y)\s*(\d{1,2})\s*(?:años|years)/i)
  if (range) return { min: +range[1], max: +range[2] }
  const one = text.match(/(\d{1,2})\s*\+?\s*(?:años|years)/i)
  return one ? { min: +one[1] } : undefined
}

/** Arma la oferta a partir de los números de línea. Devuelve null si el resultado no es utilizable (→ respaldo JSON). */
export function offerFromIndices(lines: string[], ix: LineIndices): Offer | null {
  const valid = (n: number | null | undefined): n is number => n != null && n >= 0 && n < lines.length
  const take = (xs: number[]) => [...new Set(xs.filter(valid))].sort((a, b) => a - b).map((i) => strip(lines[i])).filter((x) => x.length >= 3)
  if (!valid(ix.title)) return null
  const { title, company: fromTitle } = splitTitleLine(lines[ix.title])
  const company = valid(ix.company) ? strip(lines[ix.company]) : fromTitle
  const requirements = take(ix.requirements)
  const niceToHave = take(ix.niceToHave)
  const responsibilities = take(ix.responsibilities)
  if (requirements.length + niceToHave.length + responsibilities.length === 0) return null
  const body = [...requirements, ...niceToHave]
  const all = lines.join("\n")
  return offerSchema.parse({
    title,
    company,
    language: detectLanguage(all).lang,
    seniority: seniorityIn(`${title}\n${all}`),
    yearsExperience: yearsIn(all),
    requirements,
    niceToHave,
    responsibilities,
    tools: toolsIn(body),
    softSkills: softSkillsIn(all),
    languagesRequired: languagesIn(body),
  })
}

export async function labelOffer(text: string, signal?: AbortSignal): Promise<{ offer: Offer | null; lines: string[]; ms: number; meta?: { provider: string; model: string; ms: number; attempts: number } }> {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 120)
  const t0 = Date.now()
  const numbered = lines.map((l, i) => `${i}: ${l}`).join("\n")
  const { data, meta } = await getProvider().generateStructured({ system: LABEL_PROMPT, user: `Líneas:\n${numbered}`, schema: indicesSchema, signal, options: { numPredict: 300 } })
  return { offer: offerFromIndices(lines, data), lines, ms: Date.now() - t0, meta }
}
