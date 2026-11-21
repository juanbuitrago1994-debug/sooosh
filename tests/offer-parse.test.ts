import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const generate = vi.fn()
let failWith: Error | null = null
vi.mock("@/lib/ai", async (orig) => ({ ...(await orig<typeof import("@/lib/ai")>()), getProvider: () => ({ name: "mock", generateStructured: (r: unknown) => (failWith ? Promise.reject(failWith) : generate(r)) }) }))

import { AIError } from "@/lib/ai"
import { OFFER_SYSTEM_PROMPT, parseOfferText } from "@/lib/ai/parse-offer"
import { indicesSchema, languagesIn, offerFromIndices, seniorityIn, toolsIn, yearsIn } from "@/lib/ai/parse-offer-lines"
import { POST } from "@/app/api/offer/route"
import { offerSchema } from "@/lib/schemas/offer"

const texto = readFileSync(path.join(__dirname, "fixtures/offers/texto.txt"), "utf8").repeat(2)
const req = (body: unknown) => new Request("http://x/api/offer", { method: "POST", body: JSON.stringify(body) })

beforeEach(() => {
  generate.mockReset()
  failWith = null
})

describe("parseOfferText", () => {
  it("pide al modelo el esquema Offer y un prompt que prohíbe inventar", async () => {
    generate.mockResolvedValue({ data: { title: "Analista", language: "es", requirements: [], niceToHave: [], responsibilities: [] }, meta: {} })
    await parseOfferText(texto)
    // 1.ª llamada: índices de línea (camino rápido); como la respuesta simulada no los trae, cae al respaldo JSON completo.
    expect(generate.mock.calls[0][0].schema).toBe(indicesSchema)
    const arg = generate.mock.calls[1][0]
    expect(arg.schema).toBe(offerSchema)
    expect(arg.system).toBe(OFFER_SYSTEM_PROMPT)
    expect(arg.system).toMatch(/No inventes/)
    expect(arg.user).toContain("Analista de Datos Junior")
  })
})

describe("parseOfferText: camino rápido por líneas", () => {
  it("arma la oferta con una sola llamada corta y solo con líneas literales del texto", async () => {
    generate.mockReset()
    generate.mockResolvedValue({ data: { title: 0, company: null, requirements: [3, 4], niceToHave: [7], responsibilities: [9] }, meta: { provider: "ollama", model: "m", ms: 1, attempts: 1 } })
    const r = await parseOfferText(texto)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(r.via).toBe("lineas")
    expect(r.data.title).toBe("Analista de Datos Junior")
    // el modelo eligió 2 de los 3 requisitos de la sección «Requisitos»; la conciliación con los bloques agrega el que omitió
    expect(r.data.requirements.length).toBe(3)
    for (const x of [...r.data.requirements, ...r.data.niceToHave, ...r.data.responsibilities]) expect(texto).toContain(x)
  })
  it("ignora índices fuera de rango y, sin título válido, usa el respaldo JSON", () => {
    expect(offerFromIndices(["a título largo", "- req uno"], { title: 9, requirements: [1], niceToHave: [], responsibilities: [] })).toBeNull()
    const o = offerFromIndices(["Analista de Datos", "- Dominio de SQL"], { title: 0, requirements: [1, 77], niceToHave: [], responsibilities: [] })
    expect(o?.requirements).toEqual(["Dominio de SQL"])
  })
  it("quita también las viñetas de emoji de LinkedIn al armar las listas", () => {
    const o = offerFromIndices(["Diseñador UX/UI", "🔹 Dominio de Figma", "📌 Trabajo en equipo"], { title: 0, requirements: [1, 2], niceToHave: [], responsibilities: [] })
    expect(o?.requirements).toEqual(["Dominio de Figma", "Trabajo en equipo"])
  })
  it("deriva sin IA herramientas completas (Power BI), seniority, años e idiomas", () => {
    expect(toolsIn(["- Power BI o Tableau", "- Dominio de Excel y SQL"])).toEqual(expect.arrayContaining(["Power BI", "Tableau", "Excel", "SQL"]))
    expect(toolsIn(["- Dominio de Excel"])).not.toContain("Dominio")
    expect(seniorityIn("Analista Semi Senior")).toBe("semi-senior")
    expect(yearsIn("3 a 5 años de experiencia")).toEqual({ min: 3, max: 5 })
    expect(languagesIn(["Inglés intermedio (B1)"])).toEqual([{ language: "Inglés", level: "B1" }])
  })
})

describe("POST /api/offer", () => {
  it("rechaza texto de menos de 200 caracteres sin llamar al modelo", async () => {
    const res = await POST(req({ text: "muy corto" }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/muy corta/)
    expect(generate).not.toHaveBeenCalled()
  })

  it("con texto devuelve la oferta estructurada", async () => {
    generate.mockResolvedValue({ data: { title: "Analista", language: "es", requirements: ["Excel"], niceToHave: [], responsibilities: [] }, meta: { model: "m" } })
    const res = await POST(req({ text: texto }))
    expect(res.status).toBe(200)
    expect((await res.json()).offer.title).toBe("Analista")
  })

  it("con URL inválida o sin datos responde 400 en español", async () => {
    const a = await POST(req({ url: "esto no es un enlace" }))
    expect(a.status).toBe(400)
    expect((await a.json()).error).toMatch(/no es válida/)
    const b = await POST(req({}))
    expect(b.status).toBe(400)
  })

  it("traduce errores del modelo a un estado HTTP y un mensaje", async () => {
    failWith = new AIError("unreachable", "No se pudo conectar con Ollama")
    const res = await POST(req({ text: texto }))
    expect(res.status).toBe(503)
    expect((await res.json()).error).toMatch(/Ollama/)
  })
})
