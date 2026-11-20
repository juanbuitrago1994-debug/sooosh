import { beforeEach, describe, expect, it, vi } from "vitest"

let output: unknown
vi.mock("@/lib/ai", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai")>()),
  getProvider: () => ({ name: "mock", generateStructured: () => Promise.resolve({ data: output, meta: { provider: "mock", model: "m", ms: 1, attempts: 1 } }) }),
}))

import { OFFER_SYSTEM_PROMPT, guardOffer, parseOfferText } from "@/lib/ai/parse-offer"
import { existsInSource, guardList } from "@/lib/offer/guard"
import { offerSchema, type Offer } from "@/lib/schemas/offer"

const SOURCE = `Analista de Datos Semi Senior — Initech (híbrido, Lima)
Requisitos:
- 3 a 5 años de experiencia en análisis de datos
- Dominio de SQL y Excel avanzado
- Experiencia con Power BI o Tableau
- Inglés intermedio (B1)
Responsabilidades:
- Construir y mantener tableros de ventas
Se valora: conocimientos de Python. Comunicación efectiva.`

const base = (o: Partial<Offer> = {}): Offer => ({ title: "Analista de Datos Semi Senior", company: "Initech", language: "es", requirements: [], niceToHave: [], responsibilities: [], ...o })

beforeEach(() => {
  output = undefined
})

describe("existsInSource", () => {
  it("acepta subcadenas sin importar tildes, mayúsculas o signos", () => {
    expect(existsInSource("dominio de sql y excel AVANZADO", SOURCE).ok).toBe(true)
    expect(existsInSource("Experiencia con Power BI o Tableau.", SOURCE).ok).toBe(true)
  })
  it("acepta una reordenación leve, pero no frases con contenido nuevo", () => {
    expect(existsInSource("Excel avanzado y dominio de SQL", SOURCE).ok).toBe(true)
    expect(existsInSource("Experiencia con Spark y Kubernetes", SOURCE).ok).toBe(false)
    expect(existsInSource("Maestría en estadística", SOURCE).ok).toBe(false)
  })
  it("guardList separa lo hallado de lo descartado", () => {
    const g = guardList(["Dominio de SQL", "Certificación PMP", "Python"], SOURCE)
    expect(g.kept).toEqual(["Dominio de SQL", "Python"])
    expect(g.dropped).toEqual(["Certificación PMP"])
  })
})

describe("capa 3 · guardOffer", () => {
  it("descarta requisitos, herramientas, habilidades e idiomas que no están en el texto", () => {
    const { offer, dropped } = guardOffer(
      base({
        requirements: ["Dominio de SQL y Excel avanzado", "Experiencia con Kubernetes y Spark"],
        niceToHave: ["conocimientos de Python", "Certificación AWS"],
        responsibilities: ["Construir y mantener tableros de ventas", "Liderar un equipo de 10 personas"],
        tools: ["SQL", "Excel", "Docker"],
        softSkills: ["Comunicación efectiva", "Pensamiento sistémico"],
        languagesRequired: [{ language: "Inglés", level: "B1" }, { language: "Alemán" }],
      }),
      SOURCE,
    )
    expect(offer.requirements).toEqual(["Dominio de SQL y Excel avanzado"])
    expect(offer.niceToHave).toEqual(["conocimientos de Python"])
    expect(offer.responsibilities).toEqual(["Construir y mantener tableros de ventas"])
    expect(offer.tools).toEqual(["SQL", "Excel"])
    expect(offer.softSkills).toEqual(["Comunicación efectiva"])
    expect(offer.languagesRequired).toEqual([{ language: "Inglés", level: "B1" }])
    expect(dropped).toEqual(expect.arrayContaining(["Experiencia con Kubernetes y Spark", "Certificación AWS", "Liderar un equipo de 10 personas", "Docker", "Pensamiento sistémico", "Alemán"]))
  })

  it("seniority y años solo si el texto los respalda", () => {
    const ok = guardOffer(base({ seniority: "semi-senior", yearsExperience: { min: 3, max: 5 } }), SOURCE)
    expect(ok.offer.seniority).toBe("semi-senior")
    expect(ok.offer.yearsExperience).toEqual({ min: 3, max: 5 })
    const bad = guardOffer(base({ seniority: "senior", yearsExperience: { min: 8 } }), SOURCE)
    expect(bad.offer.seniority).toBe("no-especificado")
    expect(bad.offer.yearsExperience).toBeUndefined()
    expect(bad.dropped.join(" ")).toMatch(/seniority: senior/)
    expect(bad.dropped.join(" ")).toMatch(/años de experiencia: 8/)
  })

  it("una empresa inventada se descarta; un título no literal se conserva pero se avisa", () => {
    const r = guardOffer(base({ company: "Globex", title: "Científico de Datos" }), SOURCE)
    expect(r.offer.company).toBeUndefined()
    expect(r.offer.title).toBe("Científico de Datos")
    expect(r.dropped.join(" ")).toMatch(/título no literal/)
  })
})

describe("parseOfferText", () => {
  it("el prompt prohíbe inventar y pide los campos nuevos", () => {
    expect(OFFER_SYSTEM_PROMPT).toMatch(/SOLO lo que está escrito/)
    for (const f of ["tools", "softSkills", "seniority", "yearsExperience", "languagesRequired"]) expect(OFFER_SYSTEM_PROMPT).toContain(f)
  })
  it("devuelve la oferta ya filtrada por la guardia y lo descartado", async () => {
    output = offerSchema.parse({ ...base(), requirements: ["Dominio de SQL y Excel avanzado", "Experiencia con Spark"], tools: ["SQL", "Spark"] })
    const r = await parseOfferText(SOURCE)
    expect(r.data.requirements).toEqual(["Dominio de SQL y Excel avanzado"])
    expect(r.data.tools).toEqual(["SQL"])
    expect(r.dropped).toEqual(expect.arrayContaining(["Experiencia con Spark", "Spark"]))
  })
})

describe("esquema ampliado", () => {
  it("los campos nuevos son opcionales y no rompen ofertas mínimas", () => {
    const o = offerSchema.parse({ title: "Dev", language: "es" })
    expect(o.requirements).toEqual([])
    expect(o.tools).toBeUndefined()
  })
  it("valida seniority y años", () => {
    expect(offerSchema.safeParse({ title: "Dev", language: "es", seniority: "genio" }).success).toBe(false)
    expect(offerSchema.safeParse({ title: "Dev", language: "es", yearsExperience: { min: 99 } }).success).toBe(false)
    expect(offerSchema.safeParse({ title: "Dev", language: "es", seniority: "junior", yearsExperience: { min: 1, max: 3 } }).success).toBe(true)
  })
})
