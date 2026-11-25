import { z } from "zod"
import { AIError, getProvider } from "@/lib/ai"
import { parseCvText } from "@/lib/ai/parse-cv"
import { existsInSource } from "@/lib/offer/guard"
import { cvSchema, type CV } from "@/lib/schemas/cv"
import { diagnosisSchema, type Diagnosis } from "@/lib/schemas/diagnosis"
import { parseEduHead, parseJobHead, splitEducation } from "./heads"
import { bulletItems, splitBlocks, splitExperienceBlocks, type Block } from "./blocks"
import { extractContact } from "./contact"
import { RANGE_RE } from "./dates"
import { computeConfidence, computeSeniority, computeStyle, detectLanguage, findAtsRisks, findProblems, pickQuestion } from "./diagnosis"
import { parseLanguages, parseSkills } from "./lists"
import { splitSections, type Section } from "./sections"
import { applySegmentation, numberLines, SEGMENT_PROMPT, segmentSchema } from "./segment"

/**
 * Pipeline del CV por etapas. En vez de UNA llamada enorme al modelo (212 s), todo lo que se puede resolver
 * sin IA se resuelve sin IA (secciones, contacto, fechas, viñetas, habilidades, idiomas, métricas) y el modelo
 * solo interpreta fragmentos pequeños: la cabecera de cada puesto, la formación y las fortalezas.
 * Cada dato que propone el modelo se verifica contra el texto fuente.
 */
export { STAGES } from "./stages"

export type Timings = Record<string, number>
export type PipelineResult = {
  cv: CV
  diagnosis: Diagnosis
  timings: Timings
  method: "estructurado" | "clasico"
  llmCalls: number
  truncated: boolean
}

const MAX_TEXT = 14_000
const FATAL = new Set(["unreachable", "not_configured", "model_missing", "timeout"])

// ───────────────────────── identidad (heurística; el modelo solo si falla) ─────────────────────────
const isContactLine = (l: string) => /@|https?:|www\.|linkedin|github|\d[\d\s().-]{7,}\d/i.test(l)

export function heuristicIdentity(header: string): { fullName?: string; headline?: string; location?: string } {
  // El OCR a veces deja un resto pegado al nombre («Mario Quintero 6», «Mario Quintero ®»): se quita si quedan ≥ 2 palabras.
  const lines = header.split("\n").map((l) => l.trim().replace(/(?:\s+(?:\d{1,2}|[^\p{L}\p{N}\s]+))+$/u, "")).filter(Boolean)
  const plausible = (l: string) => !isContactLine(l) && /^[\p{L}][\p{L} .'’-]+$/u.test(l) && l.split(/\s+/).length >= 2 && l.split(/\s+/).length <= 5
  // Un nombre se escribe «Mario Quintero» (cada palabra con mayúscula inicial y resto en minúscula): se prefiere ese
  // patrón sobre el ruido en mayúsculas que deja el OCR en banners («III ITALIA TIA»).
  const titleCase = (l: string) => l.split(/\s+/).every((w) => /^\p{Lu}\p{Ll}{2,}$/u.test(w) || /^(de|del|la|las|los|y|da|di|van|von|[A-Z]\.)$/i.test(w))
  const nameIdx = (() => {
    const i = lines.slice(0, 15).findIndex((l) => plausible(l) && titleCase(l))
    return i >= 0 ? i : lines.findIndex(plausible)
  })()
  const fullName = nameIdx >= 0 ? lines[nameIdx] : undefined
  const next = nameIdx >= 0 ? lines[nameIdx + 1] : undefined
  const isPlace = (l: string) => /^[\p{L} .'’-]+,\s*[\p{L} .'’-]+$/u.test(l)
  const headline = next && !isContactLine(next) && !isPlace(next) && next.length <= 90 ? next : undefined
  let location: string | undefined
  for (const l of lines) {
    for (const seg of l.split(/[|·•]/).map((s) => s.trim())) {
      if (/^[\p{L} .'’-]+,\s*[\p{L} .'’-]+$/u.test(seg) && !isContactLine(seg) && seg !== fullName && seg !== headline) location = location ?? seg
    }
  }
  return { fullName, headline, location }
}

// ───────────────────────── llamadas pequeñas al modelo ─────────────────────────
const identitySchema = z.object({ fullName: z.string().optional(), headline: z.string().optional(), location: z.string().optional() })
const jobSchema = z.object({ company: z.string().optional(), role: z.string().optional(), location: z.string().optional() })
const eduSchema = z.object({
  items: z.array(z.object({ institution: z.string(), degree: z.string().optional(), field: z.string().optional(), startDate: z.string().optional(), endDate: z.string().optional() })),
})
/** Las fortalezas se piden como NÚMEROS de viñeta (≈12 tokens de salida): el texto es el del propio CV, no se puede inventar. */
const picksSchema = z.object({ picks: z.array(z.number().int().min(0)).max(6) })

export const PROMPTS = {
  identity: `Del encabezado de un CV extrae "fullName" (nombre completo), "headline" (título profesional bajo el nombre) y "location" (ciudad y país). Copia el texto tal cual. Si un dato no está, omítelo. No inventes.`,
  job: `Recibes la cabecera de un puesto de un CV (sin las fechas). Devuelve "role" (cargo), "company" (empresa) y "location" (ciudad/país) copiando el texto tal cual. "company" es SIEMPRE la organización que contrata, no la ciudad. Si un dato no está, omítelo. No inventes ni traduzcas.`,
  education: `Recibes la sección de formación de un CV. Devuelve cada estudio en "items": institution, degree (título o carrera), field (área) y las fechas startDate/endDate tal como están escritas. Copia el texto tal cual; omite lo que no aparezca. No inventes.`,
  strengths: `Recibes las viñetas numeradas de un CV. Elige hasta 4 que mejor demuestren logros concretos (resultados medibles, impacto o responsabilidad clara). Devuelve únicamente {"picks": [números de viñeta]}.`,
} as const

async function ask<T>(timings: Timings, name: string, schema: z.ZodType<T>, system: string, user: string, opts: { numPredict: number }, signal?: AbortSignal): Promise<T | null> {
  const t0 = Date.now()
  try {
    const { data } = await getProvider().generateStructured<T>({ system, user, schema, signal, options: opts })
    return data
  } catch (e) {
    if (e instanceof AIError && FATAL.has(e.code)) throw e
    if ((e as Error).name === "AbortError") throw e
    return null // salida inválida: se usa el respaldo determinista
  } finally {
    const ms = Date.now() - t0
    timings[name] = (timings[name] ?? 0) + ms
    console.info(`[cv] ${name} ${ms} ms`)
  }
}

// ───────────────────────── ensamblado ─────────────────────────
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim()
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s)

function jobFromBlock(block: Block, llm: z.infer<typeof jobSchema> | null, det: ReturnType<typeof parseJobHead>): CV["experience"][number] {
  const headText = block.head.join(" · ")
  const m = RANGE_RE.exec(headText)
  const guard = (v?: string) => (v && existsInSource(v, headText).ok ? oneLine(v) : undefined)
  const role = guard(llm?.role) ?? det.role ?? (det.company ? "" : oneLine(block.head[0] ?? ""))
  const company = guard(llm?.company) ?? det.company
  return {
    role: clip(role || (company || det.company ? "(puesto no indicado)" : "Puesto"), 120),
    company: clip(company || "(empresa no detectada)", 120),
    location: guard(llm?.location) ?? det.location,
    startDate: m ? m[1].trim() : "",
    endDate: m ? m[2].trim() : undefined,
    bullets: block.bullets.map((b) => clip(oneLine(b), 400)).filter(Boolean),
  }
}

function parseProjects(text: string): CV["projects"] {
  const blocks = splitBlocks(text)
  // Un PDF conserva las viñetas que el Word no tiene: «• Proyecto (2025): descripción» sin cabecera aparte. Cada viñeta es un proyecto (nombre antes de «:», lo demás es la descripción).
  if (blocks.length === 0) {
    return bulletItems(text).map((item) => {
      const i = item.indexOf(":")
      const split = i > 0 && i <= 80
      return {
        name: clip(oneLine(split ? item.slice(0, i) : item), 120),
        description: split && item.slice(i + 1).trim() ? clip(oneLine(item.slice(i + 1)), 600) : undefined,
        url: extractContact(item).links[0]?.url,
        technologies: [] as string[],
        bullets: [] as string[],
      }
    })
  }
  return blocks
    .map((b) => {
      const tech = b.head.find((l) => /^(tecnolog[ií]as|stack|tech|herramientas)\s*:/i.test(l))
      const head = b.head.filter((l) => l !== tech)
      return {
        name: clip(head[0] ?? "Proyecto", 120),
        description: head.length > 1 ? clip(oneLine(head.slice(1).join(" ")), 600) : undefined,
        url: extractContact(b.head.join(" ")).links[0]?.url,
        technologies: tech ? tech.split(":").slice(1).join(":").split(/[,;|]/).map((s) => s.trim()).filter(Boolean).slice(0, 20) : [],
        bullets: b.bullets.map((x) => clip(oneLine(x), 400)).filter(Boolean),
      }
    })
    .filter((p) => p.name)
}

function sectionText(sections: Section[], kind: Section["kind"]) {
  return sections.filter((s) => s.kind === kind).map((s) => s.text).join("\n")
}

const METRIC_RE = /\d|%/

/** Fortalezas: viñetas con resultados que el modelo señala por número; sin modelo, las que traen cifras. */
async function pickStrengths(cv: CV, timings: Timings, signal: AbortSignal | undefined, count: { n: number }): Promise<Diagnosis["strengths"]> {
  const bullets = cv.experience.flatMap((e) => e.bullets).concat(cv.projects.flatMap((p) => p.bullets)).filter((b) => b.length >= 25)
  if (bullets.length === 0) return []
  const byMetrics = () => bullets.map((b, i) => ({ b, i })).filter((x) => METRIC_RE.test(x.b)).slice(0, 3)
  if (bullets.length <= 3) return bullets.map((b) => ({ text: b, evidence: b }))
  count.n++
  const numbered = bullets.slice(0, 24).map((b, i) => `${i}: ${b}`).join("\n").slice(0, 3200)
  const r = await ask(timings, "fortalezas", picksSchema, PROMPTS.strengths, `Viñetas:\n${numbered}`, { numPredict: 60 }, signal)
  const picked = [...new Set(r?.picks ?? [])].filter((i) => i >= 0 && i < Math.min(24, bullets.length)).slice(0, 4)
  const chosen = picked.length ? picked.map((i) => bullets[i]) : byMetrics().map((x) => x.b)
  return chosen.map((b) => ({ text: b, evidence: b }))
}

export async function runCvPipeline(
  rawText: string,
  opts: { signal?: AbortSignal; onStage?: (index: number) => void; now?: Date } = {},
): Promise<PipelineResult> {
  const timings: Timings = {}
  let llmCalls = 0
  const truncated = rawText.length > MAX_TEXT
  const text = rawText.slice(0, MAX_TEXT)
  const stage = (i: number) => opts.onStage?.(i)
  const timed = async <T>(name: string, fn: () => Promise<T> | T): Promise<T> => {
    const t0 = Date.now()
    try {
      return await fn()
    } finally {
      timings[name] = (timings[name] ?? 0) + (Date.now() - t0)
    }
  }

  // ── 1 · secciones (determinista)
  stage(1)
  let { header, sections } = await timed("secciones", () => splitSections(text))
  let hasExperience = sections.some((s) => s.kind === "experience")

  // Sin encabezados reconocibles (un Word «lleno de datos»): el modelo SOLO señala en qué número de línea empieza cada
  // sección; el contenido sigue siendo el texto original y el resto del pipeline determinista funciona igual.
  if (!hasExperience) {
    stage(1)
    llmCalls++
    const lines = text.split("\n")
    const seg = await ask(timings, "segmentacion", segmentSchema, SEGMENT_PROMPT, `CV:\n${numberLines(lines)}`, { numPredict: 160 }, opts.signal)
    const applied = seg && Array.isArray(seg.sections) ? applySegmentation(lines, seg) : null
    // Solo se acepta si la experiencia propuesta contiene al menos un puesto con fechas (si no, es mejor el método clásico).
    if (applied && splitExperienceBlocks(sectionText(applied.sections, "experience")).some((b) => b.head.some((l) => RANGE_RE.test(l)))) {
      header = applied.header
      sections = applied.sections
      hasExperience = true
    }
  }

  // Sigue sin estructura: método clásico (una llamada al modelo), con el mismo diagnóstico después.
  if (sections.length === 0 || !hasExperience) {
    stage(3)
    const r = await timed("lectura-clasica", () => parseCvText(text, opts.signal))
    llmCalls++
    return finish({ cv: r.data, text, sections, nameSource: "modelo", timings, method: "clasico", llmCalls, truncated: truncated || r.truncated, opts, stage })
  }

  // ── 2 · identidad y datos sin IA
  stage(2)
  const headerText = header || text.split("\n").slice(0, 8).join("\n")
  const contact = extractContact(headerText + "\n" + text.slice(0, 800), text)
  let ident = heuristicIdentity(headerText)
  let nameSource: "heuristica" | "modelo" | "ninguna" = ident.fullName ? "heuristica" : "ninguna"
  if (!ident.fullName) {
    llmCalls++
    const r = await ask(timings, "identidad", identitySchema, PROMPTS.identity, `Encabezado:\n"""\n${headerText.slice(0, 700)}\n"""`, { numPredict: 120 }, opts.signal)
    const ok = (v?: string) => (v && existsInSource(v, headerText).ok ? oneLine(v) : undefined)
    if (r && ok(r.fullName)) {
      ident = { fullName: ok(r.fullName), headline: ok(r.headline), location: ok(r.location) }
      nameSource = "modelo"
    }
  }

  // ── 3 · experiencia: bloques y cabeceras deterministas; el modelo solo para las cabeceras ambiguas
  stage(3)
  const blocks = splitExperienceBlocks(sectionText(sections, "experience"))
  const parsedHeads = blocks.map((b) => parseJobHead(b.head))
  const heads: (z.infer<typeof jobSchema> | null)[] = []
  for (let i = 0; i < blocks.length; i++) {
    const h = parsedHeads[i]
    if (h.confident) {
      heads.push({ role: h.role, company: h.company, location: h.location })
      continue
    }
    // Ambigua → una llamada diminuta (en serie: Ollama procesa de a una y los contextos distintos recargan el modelo).
    llmCalls++
    const m = RANGE_RE.exec(blocks[i].head.join(" · "))
    const headText = oneLine((m ? blocks[i].head.join(" · ").replace(m[0], " ") : blocks[i].head.join(" · ")).slice(0, 300))
    heads.push(await ask(timings, "experiencia", jobSchema, PROMPTS.job, `Cabecera:\n"""\n${headText}\n"""`, { numPredict: 100 }, opts.signal))
  }
  const experience = blocks.map((b, i) => jobFromBlock(b, heads[i], parsedHeads[i])).filter((e) => e.bullets.length > 0 || e.startDate)

  // ── 4 · formación: determinista; el modelo solo si no se pudo identificar la institución
  stage(4)
  const eduText = sectionText(sections, "education")
  let education: CV["education"] = []
  if (eduText) {
    const eduBlocks = splitEducation(eduText)
    const eduHeads = eduBlocks.map((b) => parseEduHead(b.head))
    education = eduBlocks
      .map((b, i) => ({ h: eduHeads[i], b }))
      .filter(({ h }) => h.institution)
      .map(({ h, b }) => ({ institution: clip(h.institution!, 160), degree: h.degree ? clip(h.degree, 160) : undefined, field: undefined, startDate: h.startDate, endDate: h.endDate, details: b.bullets.slice(0, 4).map((x) => clip(x, 300)) }))
    if (education.length === 0 || eduHeads.every((h) => !h.confident)) {
      llmCalls++
      const r = await ask(timings, "formacion", eduSchema, PROMPTS.education, `Formación:\n"""\n${eduText.slice(0, 1500)}\n"""`, { numPredict: 400 }, opts.signal)
      const g = (v?: string) => (v && existsInSource(v, eduText).ok ? oneLine(v) : undefined)
      const viaModel = (r?.items ?? [])
        .map((e) => ({ institution: g(e.institution) ?? "", degree: g(e.degree), field: g(e.field), startDate: g(e.startDate), endDate: g(e.endDate), details: [] as string[] }))
        .filter((e) => e.institution)
      if (viaModel.length >= education.length) education = viaModel
    }
  }

  // ── datos restantes sin IA
  const skills = parseSkills(sectionText(sections, "skills"))
  const languages = parseLanguages(sectionText(sections, "languages"))
  const projects = parseProjects(sectionText(sections, "projects"))
  const summary = oneLine(sectionText(sections, "summary"))

  const cvRaw = {
    header: { fullName: ident.fullName ?? "Sin nombre", headline: ident.headline, email: contact.email, phone: contact.phone, location: ident.location, links: contact.links },
    summary: summary ? clip(summary, 1200) : undefined,
    experience,
    education,
    skills,
    languages,
    projects,
  }
  const parsed = cvSchema.safeParse(cvRaw)
  if (!parsed.success) {
    // Último recurso: método clásico (una sola llamada).
    stage(3)
    const r = await timed("lectura-clasica", () => parseCvText(text, opts.signal))
    llmCalls++
    return finish({ cv: r.data, text, sections, nameSource: "modelo", timings, method: "clasico", llmCalls, truncated: truncated || r.truncated, opts, stage })
  }
  return finish({ cv: parsed.data, text, sections, nameSource, timings, method: "estructurado", llmCalls, truncated, opts, stage })
}

async function finish(a: {
  cv: CV
  text: string
  sections: Section[]
  nameSource: "heuristica" | "modelo" | "ninguna"
  timings: Timings
  method: PipelineResult["method"]
  llmCalls: number
  truncated: boolean
  opts: { signal?: AbortSignal; now?: Date }
  stage: (i: number) => void
}): Promise<PipelineResult> {
  // ── 5 · diagnóstico (determinista + fortalezas con cita verificada)
  a.stage(5)
  const t0 = Date.now()
  const lang = detectLanguage(a.text)
  const style = computeStyle(a.cv, a.text, lang.lang)
  const confidence = computeConfidence({ nameSource: a.nameSource, cv: a.cv, lang, sections: a.sections })
  const counter = { n: 0 }
  const strengths = await pickStrengths(a.cv, a.timings, a.opts.signal, counter)
  a.llmCalls += counter.n
  const diagnosis = diagnosisSchema.parse({
    language: lang.lang,
    sections: a.sections.map((s) => ({ kind: s.kind, title: s.title, order: s.order })),
    style,
    seniority: computeSeniority(a.cv, a.opts.now),
    strengths,
    problems: findProblems(a.cv, a.sections, style),
    atsRisks: findAtsRisks(a.cv, a.sections, a.text),
    confidence,
    question: pickQuestion(confidence, a.text),
  })
  a.timings["diagnostico"] = (a.timings["diagnostico"] ?? 0) + Math.max(0, Date.now() - t0 - (a.timings["fortalezas"] ?? 0))
  return { cv: a.cv, diagnosis, timings: a.timings, method: a.method, llmCalls: a.llmCalls, truncated: a.truncated }
}
