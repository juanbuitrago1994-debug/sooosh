import { containsKeys, contentKeys, streamOf, synonymsOf } from "@/lib/keywords/lexical"
import { cosine } from "@/lib/ai/embeddings"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"
import type { Evidence, MatchResult, MatchStatus, TermMatch } from "./types"
import { buildTerms, type OfferTerm } from "./terms"
import { buildUnits, type Unit } from "./units"

/**
 * Matching entre la oferta (términos estructurados) y el CV (fragmentos de evidencia).
 *  1. Léxico: mismas palabras (sin tildes/plurales) o equivalencias es/en de la tabla de sinónimos.
 *  2. Semántico: embeddings multilingües locales PROPONEN candidatos (umbral distinto para fragmentos cortos y frases).
 *  3. Un modelo local juzga cada candidato con una salida mínima (mismo / relacionado / ninguno).
 * Reglas que no se rompen: toda evidencia es un fragmento REAL del CV; una herramienta o idioma solo cuenta por palabras o
 * sinónimos (nunca por parecido semántico: es brecha, aunque haya algo parecido); lo que no existe nunca se inventa.
 */
export type Relation = "mismo" | "relacionado" | "ninguno"
export type EmbedFn = (texts: string[]) => Promise<number[][]>
export type JudgeFn = (term: OfferTerm, evidence: Evidence[]) => Promise<Relation | null>
/** Traduce textos (solo para modelos de embeddings no multilingües): se aplica a los términos, nunca al CV. */
export type TranslateFn = (texts: string[]) => Promise<string[]>

/** Umbrales calibrados con bge-m3 (ver docs/STATUS.md, Fase D). */
export const THRESHOLDS = {
  /** fragmento corto (habilidad, título): por debajo de esto no se considera candidato */
  short: 0.66,
  /** frase de logro (viñeta): por debajo de esto no se considera candidato */
  sentence: 0.5,
  /** tan parecido que se acepta como "otro nombre" sin consultar al modelo */
  sameAuto: 0.85,
  /** máximo de candidatos que se consultan al modelo (por peso) */
  maxJudged: 16,
} as const

const SNIP = 110
const snip = (t: string) => (t.length > SNIP ? t.slice(0, SNIP - 1).trimEnd() + "…" : t)
const isSentence = (u: Unit) => u.text.split(/\s+/).length >= 5 && !["Habilidades", "Idiomas", "Titular", "Educación"].includes(u.section)
const NEVER_REFORMULATE = new Set(["tool", "language"])
const PREFERRED_SECTIONS = ["Experiencia", "Proyectos", "Habilidades", "Resumen", "Titular", "Educación", "Idiomas"]

type Lex = { status: "cubierto" | "otro-nombre"; units: Unit[] } | null

function lexicalMatch(term: OfferTerm, units: Unit[], streams: ReturnType<typeof streamOf>[]): Lex {
  const keys = contentKeys(term.text)
  if (keys.length === 0) return null
  const full = streamOf(term.text).flat()
  const syn = [...synonymsOf(keys.join(" ")), ...synonymsOf(full.join(" "))].filter((v) => v.join(" ") !== keys.join(" "))
  const own: Unit[] = []
  const other: Unit[] = []
  units.forEach((u, i) => {
    const s = streams[i]
    const flat = new Set(s.flat())
    const ownHit = containsKeys(s, keys) || containsKeys(s, full) || (keys.length >= 3 && keys.filter((k) => flat.has(k)).length / keys.length >= 0.8)
    if (ownHit) own.push(u)
    else if (syn.some((v) => containsKeys(s, v))) other.push(u)
  })
  // Término compuesto ("Strong SQL and advanced Excel"): vale si TODAS sus claves de contenido aparecen en el CV,
  // aunque sea en fragmentos distintos (con sinónimos de una sola palabra).
  const unionHit = (): Unit[] | null => {
    if (keys.length < 2) return null
    const found: Unit[] = []
    for (const k of keys) {
      const variants = [[k], ...synonymsOf(k)]
      const idx = streams.findIndex((st) => variants.some((v) => containsKeys(st, v)))
      if (idx < 0) return null
      if (!found.includes(units[idx])) found.push(units[idx])
    }
    return found
  }
  const pick = (xs: Unit[]) => [...xs].sort((a, b) => PREFERRED_SECTIONS.indexOf(a.section) - PREFERRED_SECTIONS.indexOf(b.section)).slice(0, 2)
  if (own.length) return { status: "cubierto", units: pick(own) }
  if (other.length) return { status: "otro-nombre", units: pick(other) }
  const union = unionHit()
  return union ? { status: "cubierto", units: pick(union) } : null
}

const ev = (u: Unit): Evidence => ({ id: u.id, section: u.section, text: u.text })

function explain(status: MatchStatus, term: OfferTerm, e: Evidence[], closestOnly = false): string {
  const first = e[0]
  const where = first ? `la sección ${first.section} de tu CV: «${snip(first.text)}»` : ""
  if (status === "cubierto") return `Aparece en ${where}.`
  if (status === "otro-nombre") return `Cubierto con otro nombre en ${where}.`
  if (status === "reformulable") return `Hay algo relacionado en ${where}. Se puede reformular con las palabras de la oferta, sin añadir nada nuevo.`
  if (closestOnly && first) return `Brecha: lo más cercano en tu CV es ${where}, pero no es lo mismo. No se agregará.`
  return `Brecha: no aparece ni hay nada relacionado en tu CV. No se agregará.`
}

export async function runMatch(
  cv: CV,
  offer: Offer,
  deps: { embed?: EmbedFn | null; judge?: JudgeFn | null; translate?: TranslateFn | null; embedModel?: string; embedWarning?: string } = {},
): Promise<MatchResult> {
  const timings: Record<string, number> = {}
  const t0 = Date.now()
  const terms = buildTerms(offer)
  const units = buildUnits(cv)
  const streams = units.map((u) => streamOf(u.text))
  const warnings: string[] = []
  const out = new Map<string, TermMatch>()

  // 1) léxico
  const pending: OfferTerm[] = []
  for (const t of terms) {
    const m = lexicalMatch(t, units, streams)
    if (m) {
      const e = m.units.map(ev)
      out.set(t.id, { term: t, status: m.status, score: 1, how: "lexico", evidence: e, explanation: explain(m.status, t, e) })
    } else pending.push(t)
  }
  timings.lexico = Date.now() - t0

  // 2) semántico + 3) juicio del modelo, solo para lo que el léxico no resolvió
  let method: MatchResult["method"] = "lexico"
  if (pending.length > 0 && units.length > 0 && deps.embed) {
    const t1 = Date.now()
    try {
      const termTexts = deps.translate ? await deps.translate(pending.map((t) => t.text)) : pending.map((t) => t.text)
      const vecs = await deps.embed([...units.map((u) => u.text), ...termTexts])
      const uv = vecs.slice(0, units.length)
      const tv = vecs.slice(units.length)
      method = "semantico"
      const cands: { t: OfferTerm; top: { u: Unit; s: number }[]; auto: boolean }[] = []
      pending.forEach((t, i) => {
        const sims = units.map((u, k) => ({ u, s: cosine(tv[i], uv[k]) }))
        // Las frases de logro son mejor evidencia que una palabra suelta: se les da una pequeña ventaja al ordenar.
        const ranked = sims.filter((x) => (isSentence(x.u) ? x.s >= THRESHOLDS.sentence : x.s >= THRESHOLDS.short)).sort((a, b) => b.s + (isSentence(b.u) ? 0.05 : 0) - (a.s + (isSentence(a.u) ? 0.05 : 0)))
        const closest = [...sims].sort((a, b) => b.s - a.s).slice(0, 1)
        if (ranked.length === 0) {
          const e = closest.map((c) => ev(c.u))
          out.set(t.id, { term: t, status: "ausente", score: closest[0]?.s ?? 0, how: "ninguno", evidence: [], explanation: explain("ausente", t, e.slice(0, 0)) })
        } else cands.push({ t, top: ranked.slice(0, 2), auto: ranked[0].s >= THRESHOLDS.sameAuto })
      })
      // los candidatos más pesados primero; más allá del tope se resuelve de forma conservadora
      cands.sort((a, b) => b.t.weight - a.t.weight)
      let judged = 0
      for (const c of cands) {
        const e = c.top.map((x) => ev(x.u))
        const score = c.top[0].s
        // Herramientas e idiomas: la similitud NUNCA los promueve (dos herramientas de BI se parecen, pero una no es la otra).
        // Solo cuentan por coincidencia léxica o por la tabla de sinónimos; lo más cercano se muestra como "no es lo mismo".
        if (NEVER_REFORMULATE.has(c.t.kind)) {
          out.set(c.t.id, { term: c.t, status: "ausente", score, how: "semantico", evidence: e.slice(0, 1), explanation: explain("ausente", c.t, e.slice(0, 1), true) })
          continue
        }
        let rel: Relation | null = c.auto ? "mismo" : null
        if (!rel && judged < THRESHOLDS.maxJudged && deps.judge) {
          judged++
          rel = await deps.judge(c.t, e)
        }
        if (!rel) rel = score >= 0.72 ? "mismo" : "ninguno" // sin juez: solo lo muy parecido
        const status: MatchStatus = rel === "mismo" ? "otro-nombre" : rel === "relacionado" ? "reformulable" : "ausente"
        out.set(c.t.id, {
          term: c.t,
          status,
          score,
          how: "semantico",
          evidence: status === "ausente" ? [] : e,
          explanation: explain(status, c.t, e),
        })
      }
    } catch (e) {
      // Sin embeddings no se rompe nada: queda el resultado léxico y se avisa.
      warnings.push(deps.embedWarning ?? `No se pudo comparar por significado (${(e as Error).message}). Solo se comparó por palabras: puede haber cosas cubiertas con otro nombre o en otro idioma que aparezcan como ausentes.`)
    }
    timings.semantico = Date.now() - t1
  } else if (pending.length > 0 && !deps.embed) {
    warnings.push(deps.embedWarning ?? "No hay un modelo de embeddings en Ollama (instala bge-m3: ollama pull bge-m3). Solo se comparó por palabras: puede haber cosas cubiertas con otro nombre o en otro idioma que aparezcan como ausentes.")
  }
  for (const t of pending) {
    if (!out.has(t.id)) out.set(t.id, { term: t, status: "ausente", score: 0, how: "ninguno", evidence: [], explanation: explain("ausente", t, []) })
  }

  const all = terms.map((t) => out.get(t.id)!)
  const total = all.reduce((n, m) => n + m.term.weight, 0)
  const got = all.reduce((n, m) => n + m.term.weight * (m.status === "cubierto" || m.status === "otro-nombre" ? 1 : m.status === "reformulable" ? 0.5 : 0), 0)
  const byWeight = (a: TermMatch, b: TermMatch) => b.term.weight - a.term.weight
  return {
    coverage: total ? Math.round((got / total) * 100) : 0,
    terms: all,
    groups: {
      fit: all.filter((m) => m.status === "cubierto" || m.status === "otro-nombre").sort(byWeight),
      reformulable: all.filter((m) => m.status === "reformulable").sort(byWeight),
      gaps: all.filter((m) => m.status === "ausente").sort(byWeight),
    },
    method,
    model: method === "semantico" ? deps.embedModel : undefined,
    warnings,
    timings: { ...timings, total: Date.now() - t0 },
  }
}

/** Cobertura solo léxica (síncrona y sin modelos): para comparar "antes/después" en el historial. */
export function lexicalCoverage(cv: CV, offer: Offer): number {
  const terms = buildTerms(offer)
  const units = buildUnits(cv)
  const streams = units.map((u) => streamOf(u.text))
  const total = terms.reduce((n, t) => n + t.weight, 0)
  const got = terms.reduce((n, t) => n + (lexicalMatch(t, units, streams) ? t.weight : 0), 0)
  return total ? Math.round((got / total) * 100) : 0
}
