import { describe, expect, it } from "vitest"
import { eligibility, languageCode, languageIssues, languageMessage, levelRank } from "@/lib/jobs/gates"

describe("idiomas: nombres y niveles", () => {
  it("reconoce nombres en español e inglés, con o sin tilde", () => {
    expect(["Inglés", "English", "ingles", "Inglés avanzado"].map(languageCode)).toEqual(["en", "en", "en", "en"])
    expect(languageCode("Español")).toBe("es")
    expect(languageCode("Portuguese")).toBe("pt")
    expect(languageCode("Klingon")).toBeNull()
  })
  it("niveles: CEFR y palabras comparables", () => {
    expect(levelRank("B2")).toBe(4)
    expect(levelRank("c1")).toBe(5)
    expect(levelRank("Nativo")).toBe(6)
    expect(levelRank("Intermedio")).toBe(3)
    expect(levelRank("Fluent")).toBe(5)
    expect(levelRank("según el día")).toBeNull()
    expect(levelRank(undefined)).toBeNull()
  })
})

describe("idiomas: qué avisar", () => {
  const cv = [{ name: "Español", level: "Nativo" }, { name: "Inglés", level: "B1" }]
  it("idioma exigido que el CV no lista → falta", () => {
    const r = languageIssues(cv, [{ language: "Portugués", level: "B2" }])
    expect(r).toEqual([{ language: "Portugués", kind: "falta", required: "B2" }])
    expect(languageMessage(r[0])).toContain("Si lo hablas, agrégalo en tu CV")
  })
  it("el CV lo muestra con menos nivel → nivel", () => {
    expect(languageIssues(cv, [{ language: "English", level: "C1" }])).toEqual([{ language: "English", kind: "nivel", required: "C1", has: "B1" }])
  })
  it("nivel igual o mayor, o niveles no comparables → sin aviso", () => {
    expect(languageIssues(cv, [{ language: "Inglés", level: "B1" }, { language: "Español", level: "C2" }])).toEqual([])
    expect(languageIssues([{ name: "Inglés" }], [{ language: "Inglés", level: "C1" }])).toEqual([])
    expect(languageIssues(cv, [{ language: "Inglés" }])).toEqual([])
  })
  it("el idioma en que está escrita la oferta no se exige en el CV", () => {
    expect(languageIssues([], [{ language: "Español" }], "es")).toEqual([])
    expect(languageIssues([], [{ language: "Español" }], "en")).toHaveLength(1)
  })
  it("idiomas desconocidos y repetidos no generan ruido", () => {
    expect(languageIssues(cv, [{ language: "Élfico" }])).toEqual([])
    expect(languageIssues([], [{ language: "Inglés" }, { language: "English" }])).toHaveLength(1)
  })
  it("el nivel puede venir en el nombre del idioma del CV", () => {
    expect(languageIssues([{ name: "Inglés avanzado" }], [{ language: "Inglés", level: "B2" }])).toEqual([])
  })
})

describe("elegibilidad por país", () => {
  it("oferta abierta, de LATAM (para quien vive en LATAM) o de su país → ok", () => {
    expect(eligibility("CO", { regions: ["TODAS"], country: null })).toEqual({ ok: true })
    expect(eligibility("CO", { regions: ["LATAM"], country: null })).toEqual({ ok: true })
    expect(eligibility("CO", { regions: ["CO", "LATAM"], country: "CO" })).toEqual({ ok: true })
  })
  it("de otro país → aviso con los países de la oferta", () => {
    const r = eligibility("CO", { regions: ["MX", "LATAM"].slice(0, 1), country: "MX" })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.message).toMatch(/México/)
    expect(!r.ok && r.message).toMatch(/Colombia/)
  })
  it("LATAM no sirve a quien vive fuera de LATAM", () => {
    expect(eligibility("ES", { regions: ["LATAM"], country: null }).ok).toBe(false)
  })
  it("sin país del usuario o sin regiones conocidas no se juzga", () => {
    expect(eligibility(undefined, { regions: ["MX"], country: "MX" })).toEqual({ ok: true })
    expect(eligibility("CO", { regions: [], country: null })).toEqual({ ok: true })
  })
})
