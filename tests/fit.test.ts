import { describe, expect, it } from "vitest"
import { computeFit, fitDelta } from "@/lib/analysis/fit"
import { fitWithJudge, judgeInput } from "@/lib/analysis/judge"
import { scorecardSchema, unverifiedEvidence } from "@/lib/analysis/rubric"
import type { MatchResult } from "@/lib/match/types"
import type { CV } from "@/lib/schemas/cv"

import { NOW, mid, offer, strong, weak } from "./fixtures/fit-cases"

const cvText = (cv: CV) => JSON.stringify(cv)
const dim = (r: ReturnType<typeof computeFit>, id: string) => r.scorecard.dimensions.find((d) => d.id === id)!
const crit = (r: ReturnType<typeof computeFit>, c: string) => r.scorecard.dimensions.flatMap((d) => d.findings).find((f) => f.criterion === c)!

describe("motor de fit multicapa (K4) — conjunto de referencia", () => {
  const S = computeFit(strong, offer, { now: NOW })
  const M = computeFit(mid, offer, { now: NOW })
  const W = computeFit(weak, offer, { now: NOW })

  it("la ficha es válida, determinista y tiene las 9 dimensiones", () => {
    expect(scorecardSchema.safeParse(S.scorecard).success).toBe(true)
    expect(S.scorecard.dimensions).toHaveLength(9)
    expect(computeFit(strong, offer, { now: NOW })).toEqual(S)
  })
  it("ordena los CV como lo haría una persona: fuerte > medio > débil", () => {
    expect(S.overall).toBeGreaterThan(M.overall)
    expect(M.overall).toBeGreaterThan(W.overall)
    expect(S.overall).toBeGreaterThanOrEqual(75)
    expect(W.overall).toBeLessThanOrEqual(35)
  })
  it("las brechas son exactamente lo que el CV no dice", () => {
    expect(S.gaps.map((g) => g.canonical)).toEqual([])
    expect(M.gaps.map((g) => g.canonical)).toEqual(expect.arrayContaining(["python", "power-bi", "airflow"]))
    expect(M.gaps.map((g) => g.canonical)).not.toContain("sql")
    expect(W.gaps.map((g) => g.canonical)).toEqual(expect.arrayContaining(["sql", "python", "power-bi"]))
  })
  it("una herramienta parecida NO cuenta (Tableau no cubre Power BI)", () => {
    expect(M.coverage.find((c) => c.term.canonical === "power-bi")!.status).toBe("ausente")
    expect(crit(M, "herr-cobertura").verdict).not.toBe("cumple")
  })
  it("toda cita de la ficha es texto literal del CV", () => {
    for (const [r, c] of [[S, strong], [M, mid], [W, weak]] as const) expect(unverifiedEvidence(r.scorecard, cvText(c))).toEqual([])
    expect(S.warnings).toEqual([])
  })
  it("calidad de la evidencia: en contexto vs solo en la lista", () => {
    expect(crit(S, "herr-version").verdict).toBe("cumple")
    const listOnly = computeFit({ ...strong, summary: undefined, experience: strong.experience.map((e) => ({ ...e, bullets: ["Apoyé al equipo"] })) }, offer, { now: NOW })
    expect(crit(listOnly, "herr-cobertura").verdict).toBe("cumple") // están en la lista de habilidades
    expect(crit(listOnly, "herr-version").verdict).toBe("no-cumple") // pero no se muestran en uso
  })
  it("seniority, años y educación", () => {
    expect(crit(S, "sen-anos").verdict).toBe("cumple")
    expect(crit(W, "sen-anos").verdict).toBe("no-cumple")
    expect(crit(S, "edu-requisito").verdict).toBe("cumple")
    expect(crit(M, "edu-requisito").verdict).not.toBe("no-aplica")
  })
  it("estructura: secciones, contacto y cronología", () => {
    expect(dim(S, "estructura-ats").score).toBeGreaterThan(dim(W, "estructura-ats").score)
    expect(crit(W, "est-contacto").verdict).toBe("no-cumple")
    expect(crit(S, "est-orden").verdict).toBe("cumple")
  })
  it("resumen genérico se marca con la cita literal; sin juez, los criterios cualitativos no puntúan", () => {
    expect(crit(M, "resumen-relleno").evidence).toContain("proactiva")
    expect(crit(S, "resumen-formula").verdict).toBe("no-aplica")
  })
  it("las dimensiones que la oferta no pide no cuentan en el resumen global", () => {
    const noEdu = computeFit(strong, { ...offer, requirements: offer.requirements.filter((r) => !/Licenciatura/.test(r)) }, { now: NOW })
    expect(dim(noEdu, "educacion-certificaciones").applicable).toBe(false)
  })
  it("mismo motor antes y después: añadir lo que el CV SÍ tiene sube el fit; no se inventa nada", () => {
    const improved: CV = { ...weak, experience: [{ ...weak.experience[0], bullets: [...weak.experience[0].bullets, "Reduje 20% los errores de inventario usando SQL"] }], skills: [{ items: ["Word", "SQL"] }] }
    const after = computeFit(improved, offer, { now: NOW })
    const d = fitDelta(W, after)
    expect(d.overall).toBeGreaterThan(0)
    expect(after.gaps.map((g) => g.canonical)).toContain("python")
  })
  it("capa semántica: un término técnico «reformulable» vale la mitad; las herramientas nunca por parecido", () => {
    const fake = { terms: [{ term: { id: "x", text: "Mantener pipelines ETL", kind: "responsibility", weight: 1 }, status: "reformulable", score: 0.7, how: "semantico", evidence: [{ id: "u1", section: "Experiencia", text: "Preparé tableros en Tableau" }], explanation: "" }, { term: { id: "y", text: "Power BI", kind: "tool", weight: 2 }, status: "reformulable", score: 0.8, how: "semantico", evidence: [{ id: "u2", section: "Experiencia", text: "Preparé tableros en Tableau" }], explanation: "" }] } as unknown as MatchResult
    const r = computeFit(mid, offer, { now: NOW, match: fake })
    expect(r.coverage.find((c) => c.term.canonical === "etl")!.status).toBe("relacionado") // técnico: el parecido semántico vale la mitad
    expect(r.coverage.find((c) => c.term.canonical === "power-bi")!.status).toBe("ausente")
  })
})

describe("juez local (K4)", () => {
  it("pide solo lo que el CV permite evaluar", () => {
    expect(judgeInput(strong, offer).fragments.length).toBeGreaterThan(5)
    expect(judgeInput(strong, offer).asked).toEqual(["resumen-formula", "logro-formula", "soft-demostradas"])
    expect(judgeInput(weak, { ...offer, softSkills: [] }).asked).toEqual(["logro-formula"])
  })
  it("aplica veredictos con cita literal y descarta citas inventadas", async () => {
    const judge = async () => [
      { criterion: "resumen-formula" as const, verdict: "cumple" as const, evidence: "Analista de datos con 6 años de experiencia en SQL, Python y Power BI.", note: "ok" },
      { criterion: "logro-formula" as const, verdict: "cumple" as const, evidence: "Dirigí a 200 ingenieros en la NASA", note: "inventada" },
    ]
    const r = await fitWithJudge(strong, offer, { judge, now: NOW })
    expect(crit(r, "resumen-formula").verdict).toBe("cumple")
    expect(crit(r, "logro-formula").verdict).toBe("no-aplica")
    expect(r.warnings.some((w) => w.includes("logro-formula"))).toBe(true)
  })
  it("un veredicto favorable sin cita no se acepta", async () => {
    const r = await fitWithJudge(strong, offer, { judge: async () => [{ criterion: "resumen-formula" as const, verdict: "cumple" as const, evidence: null, note: "sin cita" }], now: NOW })
    expect(crit(r, "resumen-formula").verdict).toBe("no-aplica")
    expect(r.warnings.join(" ")).toContain("sin cita")
  })
  it("si el modelo falla, la ficha se calcula con reglas y se avisa", async () => {
    const r = await fitWithJudge(strong, offer, { judge: async () => { throw new Error("caído") }, now: NOW })
    expect(r.overall).toBeGreaterThan(50)
    expect(r.warnings.join(" ")).toContain("juez local no respondió")
  })
})
