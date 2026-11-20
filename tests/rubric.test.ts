import { describe, expect, it } from "vitest"
import { DIMENSIONS, DIMENSION_IDS, TOTAL_WEIGHT, criterionIds, findingSchema, levelOf, overallScore, scorecardSchema, unverifiedEvidence, type Scorecard } from "@/lib/analysis/rubric"

const card = (score: number, evidence: string | null = "Lideré un equipo de 5 personas"): Scorecard => ({
  dimensions: DIMENSION_IDS.map((id) => ({ id, score, applicable: true, findings: [{ criterion: "x", verdict: evidence ? "cumple" : "no-cumple", basis: "cita" as const, evidence, offerRef: null, note: "ok" }] })),
})

describe("rúbrica de análisis (K1)", () => {
  it("cubre las 9 dimensiones y los pesos suman 100", () => {
    expect(DIMENSIONS.map((d) => d.id)).toEqual([...DIMENSION_IDS])
    expect(TOTAL_WEIGHT).toBe(100)
  })
  it("los ids de criterio son únicos y cada dimensión tiene al menos uno", () => {
    const ids = criterionIds()
    expect(new Set(ids).size).toBe(ids.length)
    for (const d of DIMENSIONS) expect(d.criteria.length).toBeGreaterThan(0)
  })
  it("herramientas e idiomas nunca se comprueban solo por juez (regla anti-invención)", () => {
    const herr = DIMENSIONS.find((d) => d.id === "herramientas")!
    expect(herr.criteria.find((c) => c.id === "herr-cobertura")!.check).toBe("regla")
  })
  it("un criterio cumplido sin evidencia textual es inválido; una brecha sin evidencia es válida", () => {
    expect(findingSchema.safeParse({ criterion: "a", verdict: "cumple", evidence: null, offerRef: null, note: "n" }).success).toBe(false)
    expect(findingSchema.safeParse({ criterion: "a", verdict: "no-cumple", evidence: null, offerRef: "SQL", note: "falta" }).success).toBe(true)
  })
  it("la ficha exige exactamente una entrada por dimensión", () => {
    expect(scorecardSchema.safeParse(card(50)).success).toBe(true)
    expect(scorecardSchema.safeParse({ dimensions: card(50).dimensions.slice(1) }).success).toBe(false)
  })
  it("el global es un resumen ponderado y los niveles se derivan del puntaje", () => {
    expect(overallScore(card(80))).toBe(80)
    expect([levelOf(90), levelOf(60), levelOf(20), levelOf(0)]).toEqual(["fuerte", "aceptable", "debil", "ausente"])
  })
  it("detecta evidencia que no está literalmente en el CV", () => {
    const text = "Lideré un equipo de 5 personas en Acme."
    expect(unverifiedEvidence(card(70), text)).toHaveLength(0)
    expect(unverifiedEvidence(card(70, "Dirigí 50 ingenieros"), text).length).toBe(DIMENSION_IDS.length)
  })
})
