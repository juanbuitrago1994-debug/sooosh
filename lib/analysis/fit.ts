import { containsKeys, contentKeys, streamOf } from "@/lib/keywords/lexical"
import { fullHeadline } from "@/lib/cv/headline"
import { fold } from "@/lib/keywords/normalize"
import type { MatchResult } from "@/lib/match/types"
import { buildUnits, type Unit } from "@/lib/match/units"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"
import { buildCvProfile, type CvProfile } from "./cv-profile"
import { buildOfferProfile, EDU_RANK, skillsIn, type OfferProfile, type ProfileTerm } from "./offer-profile"
import { DIMENSION_IDS, overallScore, unverifiedEvidence, type DimensionId, type DimensionResult, type Finding, type Scorecard } from "./rubric"

/**
 * Motor de fit multicapa (Fase K4). Produce la FICHA de la rúbrica (9 dimensiones con hallazgos), no un porcentaje suelto.
 * Capas: (1) cobertura de términos de la oferta por alias de taxonomía, léxico y —opcional— el matching semántico ya existente;
 * (2) calidad de la evidencia (en contexto vs solo en lista; logros con cifras); (3) seniority, años y recencia;
 * (4) estructura y lectura por ATS; (5) criterios cualitativos con juez local (opcionales, verificados contra el CV).
 * Es una función pura: el mismo CV y la misma oferta dan siempre la misma ficha, antes y después de los cambios.
 * Reglas: herramientas e idiomas solo cuentan por nombre/alias/palabras (nunca por parecido semántico); toda cita es texto literal del CV.
 */
export type CoverageStatus = "cubierto" | "relacionado" | "ausente"
export type TermCoverage = { term: ProfileTerm; status: CoverageStatus; how: "alias" | "lexico" | "semantico" | "ninguno"; evidence: Pick<Unit, "id" | "section" | "text">[]; inProse: boolean }

/** Veredictos opcionales del juez local para los criterios cualitativos (ver judge.ts). */
export type JudgedCriterion = { criterion: string; verdict: "cumple" | "parcial" | "no-cumple"; evidence: string | null; note: string }

export type FitResult = { scorecard: Scorecard; overall: number; coverage: TermCoverage[]; gaps: ProfileTerm[]; offerProfile: OfferProfile; cvProfile: CvProfile; warnings: string[] }

const PROSE = new Set<Unit["section"]>(["Experiencia", "Proyectos", "Resumen"])
const VALUE = { cumple: 1, parcial: 0.5, "no-cumple": 0 } as const
const SEM_ALLOWED = new Set(["tecnica", "transversal", "funcion", "dominio"])

const verdictOf = (v: number): "cumple" | "parcial" | "no-cumple" => (v >= 0.8 ? "cumple" : v >= 0.4 ? "parcial" : "no-cumple")
const pct = (n: number) => `${Math.round(n * 100)} %`
const clip = (t: string, n = 200) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t)

type Crit = { value: number | null; finding: Finding }

/** Construye un criterio con valor 0–1 (null = no aplica y no cuenta). La evidencia es siempre texto literal del CV. */
function crit(criterion: string, value: number | null, o: { evidence?: string | null; offerRef?: string | null; note: string; basis?: "cita" | "medicion"; verdict?: "cumple" | "parcial" | "no-cumple" }): Crit {
  if (value === null) return { value: null, finding: { criterion, verdict: "no-aplica", basis: "medicion", evidence: null, offerRef: o.offerRef ?? null, note: o.note } }
  const verdict = o.verdict ?? verdictOf(value)
  const evidence = o.evidence ? clip(o.evidence.trim()) : null
  // Sin cita solo es válido «no-cumple» o una medición del documento.
  const basis = o.basis ?? (evidence ? "cita" : "medicion")
  return { value, finding: { criterion, verdict, basis, evidence, offerRef: o.offerRef ?? null, note: o.note } }
}

function dimension(id: DimensionId, crits: Crit[]): DimensionResult {
  const scored = crits.filter((c) => c.value !== null)
  const score = scored.length ? Math.round((scored.reduce((a, c) => a + c.value!, 0) / scored.length) * 100) : 0
  return { id, score, applicable: scored.length > 0, findings: crits.map((c) => c.finding) }
}

// ---------- cobertura ----------
function coverTerm(term: ProfileTerm, units: Unit[], unitSkills: Set<string>[], streams: ReturnType<typeof streamOf>[], match?: MatchResult): TermCoverage {
  const hits: Unit[] = []
  let how: TermCoverage["how"] = "ninguno"
  if (term.canonical) {
    units.forEach((u, i) => unitSkills[i].has(term.canonical!) && hits.push(u))
    if (hits.length) how = "alias"
  } else {
    const keys = contentKeys(term.label)
    if (keys.length) {
      units.forEach((u, i) => {
        const flat = new Set(streams[i].flat())
        if (containsKeys(streams[i], keys) || (keys.length >= 3 && keys.filter((k) => flat.has(k)).length / keys.length >= 0.8)) hits.push(u)
      })
      if (hits.length) how = "lexico"
    }
  }
  if (hits.length) {
    const ordered = [...hits].sort((a, b) => Number(PROSE.has(b.section)) - Number(PROSE.has(a.section)))
    return { term, status: "cubierto", how, evidence: ordered.slice(0, 3), inProse: hits.some((u) => PROSE.has(u.section)) }
  }
  // Capa semántica (solo si ya se calculó con el motor de matching): nunca para herramientas, certificaciones ni idiomas.
  if (match && SEM_ALLOWED.has(term.category)) {
    const key = contentKeys(term.label).join(" ") || fold(term.label)
    const tm = match.terms.find((t) => (contentKeys(t.term.text).join(" ") || fold(t.term.text)) === key || fold(t.term.text) === fold(term.atsPhrase))
    if (tm && tm.status !== "ausente") {
      const ev = tm.evidence.slice(0, 3)
      return { term, status: tm.status === "reformulable" ? "relacionado" : "cubierto", how: "semantico", evidence: ev, inProse: ev.some((u) => PROSE.has(u.section)) }
    }
  }
  return { term, status: "ausente", how: "ninguno", evidence: [], inProse: false }
}

const val = (c: TermCoverage) => (c.status === "cubierto" ? 1 : c.status === "relacionado" ? 0.5 : 0)
function ratio(list: TermCoverage[]): number | null {
  const w = list.reduce((a, c) => a + c.term.weight, 0)
  return w === 0 ? null : list.reduce((a, c) => a + c.term.weight * val(c), 0) / w
}
const names = (list: TermCoverage[], status: CoverageStatus) => list.filter((c) => c.status === status).map((c) => c.term.label).slice(0, 6).join(", ")

export function computeFit(cv: CV, offer: Offer, opts: { match?: MatchResult; judged?: JudgedCriterion[]; now?: Date; rawOfferText?: string } = {}): FitResult {
  const now = opts.now ?? new Date()
  const op = buildOfferProfile(offer, opts.rawOfferText)
  const cp = buildCvProfile(cv, now)
  const units = buildUnits(cv)
  const unitSkills = units.map((u) => new Set(skillsIn(u.text).map((s) => s.id)))
  const streams = units.map((u) => streamOf(u.text))
  const coverage = op.terms.map((t) => coverTerm(t, units, unitSkills, streams, opts.match))
  const of = (cat: string, nec?: string) => coverage.filter((c) => c.term.category === cat && (!nec || c.term.necessity === nec))
  const warnings: string[] = []
  const judged = new Map((opts.judged ?? []).map((j) => [j.criterion, j]))
  const judgedCrit = (id: string, fallbackNote: string): Crit => {
    const j = judged.get(id)
    if (!j) return crit(id, null, { note: fallbackNote })
    // Un «cumple»/«parcial» sin cita del CV no se acepta: sin evidencia no hay veredicto favorable.
    if (j.verdict !== "no-cumple" && !j.evidence?.trim()) {
      warnings.push(`El juez dio «${j.verdict}» en «${id}» sin cita del CV: se descartó.`)
      return crit(id, null, { note: "El juez no aportó una cita del CV; criterio sin evaluar." })
    }
    return crit(id, VALUE[j.verdict], { verdict: j.verdict, evidence: j.evidence, note: j.note })
  }
  const dims: DimensionResult[] = []

  /** Qué tan pronto se ven las habilidades de mayor peso: titular, resumen, primeras viñetas de los dos puestos más recientes y los 3 primeros elementos de cada grupo de habilidades. */
  const ubicacion = (): Crit => {
    const parts = [fullHeadline(cv.header), cv.summary ?? "", ...cv.experience.slice(0, 2).flatMap((e) => [e.role, ...e.bullets.slice(0, 2)]), ...cv.skills.flatMap((g) => g.items.slice(0, 3))].filter(Boolean)
    const partSkills = parts.map((t) => new Set(skillsIn(t).map((s) => s.id)))
    // Las 5 de mayor peso (estén o no en el CV): así cubrir una habilidad nueva nunca baja este criterio.
    const top = coverage.filter((c) => c.term.canonical && c.term.necessity !== "contexto").slice(0, 5)
    if (top.length === 0 || !top.some((c) => c.status === "cubierto")) return crit("tec-ubicacion", null, { note: "" })
    const seen = top.filter((c) => c.status === "cubierto" && partSkills.some((set) => set.has(c.term.canonical!)))
    const firstIdx = partSkills.findIndex((set) => seen.some((c) => set.has(c.term.canonical!)))
    return crit("tec-ubicacion", seen.length / top.length, { evidence: firstIdx >= 0 ? parts[firstIdx] : null, note: `${seen.length} de las ${top.length} habilidades de mayor peso se ven al inicio (${top.map((c) => c.term.label).join(", ")}).` })
  }

  // ---- Habilidades técnicas ----
  {
    const tech = [...of("tecnica"), ...of("funcion")]
    const ob = tech.filter((c) => c.term.necessity === "obligatorio")
    const de = tech.filter((c) => c.term.necessity === "deseable")
    const covered = tech.filter((c) => c.status === "cubierto" && c.term.canonical)
    // Sobre TODAS las habilidades técnicas (por peso), no solo las cubiertas: así añadir lo que sí tienes nunca baja el resultado.
    const canon = tech.filter((c) => c.term.canonical)
    const wsum = canon.reduce((a, c) => a + c.term.weight, 0)
    const ctx = wsum > 0 && covered.length ? canon.reduce((a, c) => a + (c.status === "cubierto" && c.inProse ? c.term.weight : 0), 0) / wsum : null
    const first = (l: TermCoverage[]) => l.find((c) => c.status !== "ausente")?.evidence[0]?.text ?? null
    dims.push(
      dimension("habilidades-tecnicas", [
        crit("tec-cobertura", ratio(ob), { evidence: first(ob), offerRef: ob[0]?.term.atsPhrase, note: `Cubiertos: ${names(ob, "cubierto") || "ninguno"}. Relacionados: ${names(ob, "relacionado") || "ninguno"}. Faltan: ${names(ob, "ausente") || "ninguno"}.` }),
        crit("tec-deseables", ratio(de), { evidence: first(de), offerRef: de[0]?.term.atsPhrase, note: `Deseables cubiertos: ${names(de, "cubierto") || "ninguno"}.` }),
        ubicacion(),
        crit("tec-contexto", ctx, { evidence: covered.find((c) => c.inProse)?.evidence.find((u) => PROSE.has(u.section))?.text ?? null, note: ctx === null ? "" : `${pct(ctx)} del peso de las habilidades técnicas de la oferta aparece demostrado dentro de un logro, no solo en la lista.` }),
      ]),
    )
  }

  // ---- Herramientas ----
  {
    const tools = of("herramienta")
    const have = tools.filter((c) => c.status === "cubierto")
    const toolW = tools.reduce((a, c) => a + c.term.weight, 0)
    const ctx = toolW > 0 && have.length ? tools.reduce((a, c) => a + (c.status === "cubierto" && c.inProse ? c.term.weight : 0), 0) / toolW : null
    dims.push(
      dimension("herramientas", [
        crit("herr-cobertura", ratio(tools), { evidence: have[0]?.evidence[0]?.text ?? null, offerRef: tools[0]?.term.atsPhrase, note: `Presentes: ${names(tools, "cubierto") || "ninguna"}. Faltan: ${names(tools, "ausente") || "ninguna"}.` }),
        crit("herr-version", tools.length ? ctx : null, { evidence: have.find((c) => c.inProse)?.evidence.find((u) => PROSE.has(u.section))?.text ?? null, note: ctx === null ? "" : `${pct(ctx)} del peso de las herramientas pedidas se muestra en uso (dentro de un logro).` }),
        crit("herr-agrupadas", tools.length && cp.skills.items.length ? (cp.skills.categorized ? 1 : cp.skills.groups > 0 ? 0.5 : 0) : null, { basis: "medicion", note: cp.skills.categorized ? "Las habilidades están agrupadas por categoría." : "Las habilidades no están agrupadas por categoría." }),
      ]),
    )
  }

  // ---- Habilidades transversales ----
  {
    const soft = of("transversal")
    const v = soft.length ? soft.reduce((a, c) => a + c.term.weight * (c.status === "cubierto" ? (c.inProse ? 1 : 0.5) : 0), 0) / soft.reduce((a, c) => a + c.term.weight, 0) : null
    const j = judged.has("soft-demostradas") ? judgedCrit("soft-demostradas", "") : null
    dims.push(
      dimension("habilidades-transversales", [
        j ?? crit("soft-demostradas", v, { evidence: soft.find((c) => c.status === "cubierto")?.evidence[0]?.text ?? null, note: `Demostradas en un logro: ${soft.filter((c) => c.inProse && c.status === "cubierto").map((c) => c.term.label).join(", ") || "ninguna"}. Solo declaradas: ${soft.filter((c) => !c.inProse && c.status === "cubierto").map((c) => c.term.label).join(", ") || "ninguna"}.` }),
      ]),
    )
  }

  // ---- Titular y resumen ----
  {
    const latest = cv.experience[0]
    const roleKeys = contentKeys(op.role)
    const mine = new Set([...contentKeys(fullHeadline(cv.header)), ...contentKeys(latest?.role ?? "")])
    const overlap = roleKeys.length ? roleKeys.filter((k) => mine.has(k)).length / roleKeys.length : null
    const topTerms = coverage.filter((c) => c.term.necessity !== "contexto" && c.term.canonical).slice(0, 5)
    const sumFold = fold(cv.summary ?? "")
    const inSummary = topTerms.filter((c) => c.status === "cubierto" && c.term.aliases.some((a) => sumFold.includes(fold(a))))
    const claves = cp.summary.text ? (topTerms.filter((c) => c.status === "cubierto").length ? inSummary.length / topTerms.filter((c) => c.status === "cubierto").length : null) : topTerms.length ? 0 : null
    dims.push(
      dimension("titular-resumen", [
        crit("titular-alinea", overlap, { evidence: overlap ? cv.header.headline || latest?.role || null : null, offerRef: op.title, note: `El rol buscado es «${op.role}».` }),
        crit("resumen-claves", claves, { evidence: inSummary[0] ? cp.summary.text : null, note: cp.summary.text ? `Palabras clave respaldadas por el CV y presentes en el resumen: ${inSummary.map((c) => c.term.label).join(", ") || "ninguna"}.` : "El CV no tiene resumen." }),
        crit("resumen-relleno", cp.summary.text ? (cp.summary.cliches.length === 0 ? 1 : 0.3) : null, { evidence: cp.summary.cliches[0] ?? null, verdict: cp.summary.cliches.length ? "parcial" : undefined, basis: cp.summary.cliches.length ? "cita" : "medicion", note: cp.summary.cliches.length ? `Frases genéricas sin evidencia: «${cp.summary.cliches.join("», «")}».` : "No se encontraron frases genéricas." }),
        judgedCrit("resumen-formula", "Sin juez local no se evalúa la fórmula del resumen."),
      ]),
    )
  }

  // ---- Experiencia ----
  {
    // Relevancia de cada puesto = qué parte del peso de la oferta se encuentra en sus propias viñetas.
    const relevance = cv.experience.map((e) => {
      const hay = [e.role, ...e.bullets].join("\n")
      const ids = new Set(skillsIn(hay).map((s) => s.id))
      const flat = new Set(streamOf(hay).flat())
      const total = coverage.reduce((a, c) => a + c.term.weight, 0)
      const got = coverage.reduce((a, c) => a + (c.term.canonical ? (ids.has(c.term.canonical) ? c.term.weight : 0) : contentKeys(c.term.label).length && contentKeys(c.term.label).every((k) => flat.has(k)) ? c.term.weight : 0), 0)
      return total ? got / total : 0
    })
    const best = relevance.length ? Math.max(...relevance) : 0
    const bestIdx = relevance.indexOf(best)
    const relevant = cp.experience.filter((_, i) => relevance[i] > 0.05)
    const recent = relevant.length ? Math.min(...relevant.map((e) => e.endedYearsAgo ?? 99)) : null
    const orderOk = cp.chronology === "inversa" ? 1 : cp.chronology === "desconocida" ? null : 0
    const topTwo = bestIdx >= 0 && bestIdx <= 1
    dims.push(
      dimension("experiencia", [
        crit("exp-relevancia", cv.experience.length ? Math.min(1, best * 2.2) : 0, { evidence: bestIdx >= 0 ? cv.experience[bestIdx].role : null, note: bestIdx >= 0 ? `El puesto más afín a la oferta es «${cv.experience[bestIdx].role}» en ${cv.experience[bestIdx].company}.` : "El CV no tiene experiencia." }),
        crit("exp-recencia", recent === null ? (cv.experience.length ? 0 : null) : recent <= 1 ? 1 : recent <= 3 ? 0.6 : 0.2, { evidence: relevant[0] ? relevant[0].start : null, note: recent === null ? "Ningún puesto muestra experiencia afín a la oferta." : `La experiencia afín más reciente terminó hace ${recent} años.` }),
        crit("exp-orden", orderOk === null ? null : orderOk === 1 ? (topTwo ? 1 : 0.6) : 0, { evidence: cv.experience[0]?.startDate ?? null, basis: "cita", note: orderOk === 1 ? (topTwo ? "Cronología inversa y lo más afín está arriba." : "Cronología inversa, pero lo más afín no está entre los dos primeros puestos.") : `La cronología es ${cp.chronology}.` }),
        crit("exp-huecos", cv.experience.length ? (cp.gaps.length === 0 && cp.undatedPositions.length === 0 ? 1 : cp.gaps.length + cp.undatedPositions.length === 1 ? 0.5 : 0) : null, { evidence: cp.gaps[0]?.evidence ?? null, basis: cp.gaps.length ? "cita" : "medicion", note: cp.gaps.length || cp.undatedPositions.length ? `${cp.gaps.map((g) => `hueco de ${g.months} meses antes de ${g.evidence}`).join("; ")}${cp.undatedPositions.length ? `; ${cp.undatedPositions.length} puesto(s) sin fechas` : ""}.` : "Sin huecos ni fechas faltantes." }),
      ]),
    )
  }

  // ---- Logros ----
  {
    const b = cp.bullets
    const none = b.total === 0
    const sample = (f: (x: (typeof b.items)[number]) => boolean) => b.items.find(f)?.text ?? null
    dims.push(
      dimension("logros", [
        crit("logro-cifras", none ? null : Math.min(1, b.metricRatio / 0.4), { evidence: sample((x) => x.metrics.length > 0), note: `${b.withMetrics} de ${b.total} viñetas (${pct(b.metricRatio)}) traen una cifra; el objetivo orientativo es 40 % o más.` }),
        judgedCrit("logro-formula", "Sin juez local no se evalúa la estructura acción-contexto-resultado."),
        crit("logro-verbos", none ? null : Math.max(0, (b.withActionVerb - b.tasks * 0.5) / b.total), { evidence: sample((x) => x.verb !== null), note: `${b.withActionVerb} de ${b.total} viñetas empiezan con verbo de acción; ${b.tasks} empiezan como tarea («Responsable de…»).` }),
        crit("logro-longitud", none ? null : b.long === 0 && b.avgWords <= 28 ? 1 : b.long <= 1 ? 0.5 : 0, { evidence: sample((x) => x.words > 35), basis: b.long ? "cita" : "medicion", note: `Promedio de ${b.avgWords} palabras por viñeta; ${b.long} superan las 35.` }),
      ]),
    )
  }

  // ---- Educación y certificaciones ----
  {
    const need = op.education
    const got = cp.education.highest
    const degree = cv.education.find((e) => e.degree || e.field)
    const certs = op.certifications
    const haveCerts = certs.filter((c) => units.some((_, i) => [...unitSkills[i]].some((id) => skillsIn(c).some((s) => s.id === id)) ))
    dims.push(
      dimension("educacion-certificaciones", [
        crit("edu-requisito", need.level === "ninguno" ? null : EDU_RANK[got] >= EDU_RANK[need.level] ? 1 : EDU_RANK[got] === 0 ? 0 : 0.5, { evidence: degree ? degree.degree || degree.field || degree.institution : null, offerRef: need.phrase, note: `La oferta pide nivel ${need.level}${need.required ? " (obligatorio)" : ""}; el CV muestra ${got}.` }),
        crit("edu-certs", certs.length ? haveCerts.length / certs.length : null, { evidence: haveCerts[0] ? units.find((u) => skillsIn(u.text).some((s) => skillsIn(haveCerts[0]).some((t) => t.id === s.id)))?.text ?? null : null, offerRef: certs[0], note: `Certificaciones de la oferta: ${certs.join(", ")}; presentes: ${haveCerts.join(", ") || "ninguna"}.` }),
      ]),
    )
  }

  // ---- Seniority y años ----
  {
    const years = cp.totalYears
    const min = op.years.min
    const NEED: Record<string, number> = { practicante: 0, junior: 0, "semi-senior": 2, senior: 4, lead: 6, directivo: 10 }
    const levelMin = op.seniority ? NEED[op.seniority] : undefined
    dims.push(
      dimension("seniority-anos", [
        crit("sen-anos", min === null ? null : years === null ? 0 : years >= min ? 1 : years >= min * 0.7 ? 0.5 : 0, { basis: "medicion", offerRef: `${min} años`, note: `El CV suma ${years ?? "?"} años de experiencia (sin contar solapes); la oferta pide ${min}.` }),
        crit("sen-nivel", levelMin === undefined ? null : years === null ? 0 : years >= levelMin ? 1 : years >= levelMin * 0.75 ? 0.5 : 0, { evidence: cv.experience[0] ? `${cv.experience[0].role}` : null, offerRef: op.seniority, note: `La oferta es de nivel ${op.seniority}; el CV suma ${years ?? "?"} años (referencia orientativa: ${levelMin}+).` }),
      ]),
    )
  }

  // ---- Estructura y ATS ----
  {
    const s = cp.sections
    const present = [s.experience, s.education, s.skills, s.summary].filter(Boolean).length
    const miss = [!s.summary && "Resumen", !s.experience && "Experiencia", !s.education && "Educación", !s.skills && "Habilidades"].filter(Boolean)
    dims.push(
      dimension("estructura-ats", [
        crit("est-secciones", present / 4, { basis: "medicion", note: miss.length ? `Faltan secciones estándar: ${miss.join(", ")}.` : "Están las secciones estándar (Resumen, Experiencia, Educación, Habilidades)." }),
        crit("est-orden", cp.chronology === "desconocida" ? null : cp.chronology === "inversa" ? 1 : cp.chronology === "mixta" ? 0.3 : 0.5, { basis: "medicion", note: `Orden cronológico: ${cp.chronology}.` }),
        crit("est-contacto", cp.contact.missing.length === 0 ? 1 : cp.contact.missing.length === 1 ? 0.6 : 0.2, { evidence: cv.header.email ?? cv.header.fullName, basis: cv.header.email ? "cita" : "medicion", note: cp.contact.missing.length ? `Faltan: ${cp.contact.missing.join(", ")}.` : "Contacto completo." }),
        crit("est-extension", cp.length.words === 0 ? null : cp.length.pagesEstimate <= 2 ? 1 : cp.length.pagesEstimate <= 3 ? 0.5 : 0.2, { basis: "medicion", note: `Extensión estimada: ${cp.length.pagesEstimate} páginas (${cp.length.words} palabras).` }),
        crit("est-lectura", null, { note: "La lectura como texto se comprueba sobre el archivo exportado (K7)." }),
      ]),
    )
  }

  const order = new Map(DIMENSION_IDS.map((id, i) => [id, i]))
  const scorecard: Scorecard = { dimensions: dims.sort((a, b) => order.get(a.id)! - order.get(b.id)!) }

  // Defensa anti-invención: cualquier cita que no esté literal en el CV se degrada a «no verificable».
  const cvText = [cv.header.fullName, fullHeadline(cv.header), cv.header.email, cv.summary, ...cv.experience.flatMap((e) => [e.role, e.company, e.startDate, e.endDate, ...e.bullets]), ...cv.education.flatMap((e) => [e.institution, e.degree, e.field, ...e.details]), ...cv.skills.flatMap((g) => g.items), ...cv.projects.flatMap((p) => [p.name, p.description, ...p.bullets]), ...units.map((u) => u.text)].filter(Boolean).join("\n")
  const bad = unverifiedEvidence(scorecard, cvText)
  for (const f of bad) {
    warnings.push(`Cita no verificable en «${f.criterion}»: se descartó.`)
    f.evidence = null
    f.basis = "medicion"
    if (f.verdict === "cumple" || f.verdict === "parcial") f.verdict = "no-aplica"
  }

  // Un requisito de «N años de experiencia» no está «ausente» si los años del CV (calculados de las fechas) alcanzan el mínimo que pide la oferta.
  const yearsMet = op.years.min !== null && cp.totalYears !== null && cp.totalYears >= op.years.min
  const isYearsRequirement = (label: string) => /(?:^|\D)\d{1,2}\s*(?:\+|o m[aá]s)?\s*a[ñn]os?\b/i.test(label)

  return { scorecard, overall: overallScore(scorecard), coverage, gaps: coverage.filter((c) => c.status === "ausente" && !(yearsMet && isYearsRequirement(c.term.label))).map((c) => c.term), offerProfile: op, cvProfile: cp, warnings }
}

/** Mejora entre dos fichas (mismo motor antes y después): puntos por dimensión y global. */
export function fitDelta(before: FitResult, after: FitResult) {
  return { overall: after.overall - before.overall, dimensions: after.scorecard.dimensions.map((d) => ({ id: d.id, delta: d.score - (before.scorecard.dimensions.find((b) => b.id === d.id)?.score ?? 0) })) }
}
