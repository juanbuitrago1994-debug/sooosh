import { beforeEach, describe, expect, it, vi } from "vitest"

let respond: (() => unknown) | null = null
const seen: { user: string }[] = []
vi.mock("@/lib/ai", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai")>()),
  getProvider: () => ({ name: "mock", generateStructured: (r: { user: string }) => { seen.push({ user: r.user }); return Promise.resolve({ data: respond!(), meta: {} }) } }),
}))

import { compactLines, labelCompact, MAX_CHARS, MAX_FRAGMENTS } from "@/lib/enrich/lines"

const text = [
  "Somos una empresa que construye productos financieros para toda la región. Trabajamos con equipos de varios países.",
  "Requisitos",
  "• Experiencia de 3 años en análisis de datos con SQL y Python.",
  "• Conocimiento de Power BI.",
  "Tu rol será construir reportes semanales. También darás soporte a las áreas de negocio.",
  "ok",
  "-----",
].join("\n")

describe("texto compacto para el modelo", () => {
  it("el título va primero; las viñetas se conservan y los párrafos se parten en frases", () => {
    const l = compactLines("Analista de Datos", "Acme", text)
    expect(l[0]).toBe("Analista de Datos en Acme")
    expect(l).toContain("• Experiencia de 3 años en análisis de datos con SQL y Python.")
    expect(l).toContain("Tu rol será construir reportes semanales.")
    expect(l).toContain("También darás soporte a las áreas de negocio.")
  })
  it("descarta lo muy corto o sin letras", () => {
    const l = compactLines("X", undefined, text)
    expect(l).not.toContain("ok")
    expect(l.some((x) => /^-+$/.test(x))).toBe(false)
  })
  it("limita fragmentos, longitud de cada uno y caracteres totales", () => {
    const big = Array.from({ length: 300 }, (_, i) => `Esta es la frase número ${i} de una oferta muy larga que sigue y sigue con más palabras para llenar.`).join(" ")
    const l = compactLines("T", undefined, big)
    expect(l.length).toBeLessThanOrEqual(MAX_FRAGMENTS)
    expect(l.reduce((a, x) => a + x.length, 0)).toBeLessThanOrEqual(MAX_CHARS + 10)
    expect(Math.max(...l.map((x) => x.length))).toBeLessThanOrEqual(171)
  })
})

describe("etiquetado por números de fragmento", () => {
  beforeEach(() => {
    seen.length = 0
  })
  it("arma la oferta con fragmentos LITERALES; ignora números que no existen", async () => {
    const l = compactLines("Analista de Datos", "Acme", text)
    const iReq = l.indexOf("• Experiencia de 3 años en análisis de datos con SQL y Python.")
    const iPower = l.indexOf("• Conocimiento de Power BI.")
    const iRol = l.indexOf("Tu rol será construir reportes semanales.")
    respond = () => ({ requirements: [iReq, iPower, 999], niceToHave: [], responsibilities: [iRol] })
    const r = await labelCompact("Analista de Datos", "Acme", text)
    expect(r.offer?.requirements).toEqual(["Experiencia de 3 años en análisis de datos con SQL y Python.", "Conocimiento de Power BI."])
    expect(r.offer?.responsibilities).toEqual(["Tu rol será construir reportes semanales."])
    expect(r.offer?.yearsExperience).toEqual({ min: 3 })
    for (const item of [...r.offer!.requirements, ...r.offer!.responsibilities]) expect(text).toContain(item)
    expect(seen[0].user).toContain("0: Analista de Datos en Acme")
  })
  it("si el modelo señala demasiados fragmentos, se queda con los primeros en orden del texto en vez de fallar", async () => {
    const many = Array.from({ length: 30 }, (_, i) => `• Requisito número ${i} que se pide al candidato en esta oferta.`).join("\n")
    const l = compactLines("T", undefined, many)
    respond = () => ({ requirements: l.map((_, i) => i).slice(1).reverse(), niceToHave: [], responsibilities: [] })
    const r = await labelCompact("T", undefined, many)
    expect(r.offer!.requirements).toHaveLength(12)
    expect(r.offer!.requirements[0]).toContain("número 0")
  })
  it("si el modelo no señala nada utilizable, no hay oferta (se deja la que estaba)", async () => {
    respond = () => ({ requirements: [], niceToHave: [], responsibilities: [] })
    expect((await labelCompact("Analista", "Acme", text)).offer).toBeNull()
  })
  it("con muy poco texto ni siquiera llama al modelo", async () => {
    const r = await labelCompact("Analista", undefined, "Texto breve.")
    expect(r.offer).toBeNull()
    expect(seen).toHaveLength(0)
  })
})
