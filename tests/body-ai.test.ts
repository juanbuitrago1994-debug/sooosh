import { beforeEach, describe, expect, it, vi } from "vitest"

const generate = vi.fn()
vi.mock("@/lib/ai", () => ({ getProvider: () => ({ generateStructured: generate }) }))

import { cvFacts, isGroundedMiddle, neutralize, suggestBodies, templateMiddles, ungroundedTerms, type BodyInput } from "@/lib/apply/body-ai"
import type { CV } from "@/lib/schemas/cv"

const input: BodyInput = {
  title: "Diseñador/a UX/UI",
  company: "Vos Consultora",
  requirements: ["Dominio de Figma y sistemas de diseño", "Trabajo en equipo con desarrolladores"],
  covered: ["Diseño UX/UI", "Figma", "Trabajo en equipo"],
  facts: { headline: "Product Designer", skills: ["Figma", "Prototipado"], roles: [{ role: "Diseñador UX/UI", company: "Acme" }], languages: ["Español"] },
}
const corpus = "diseñador/a ux/ui vos consultora figma sistemas de diseño trabajo en equipo desarrolladores product designer prototipado acme español".normalize("NFD").replace(/[̀-ͯ]/g, "")
const good =
  "Trabajé como Diseñador UX/UI en Acme y uso Figma a diario para prototipar interfaces junto a desarrolladores. Me gusta el trabajo en equipo y creo que mi perfil encaja con lo que buscan en Vos Consultora para este cargo. Disfruto convertir necesidades de las personas en soluciones claras, probarlas con ellas y mejorarlas poco a poco, siempre cuidando la consistencia del sistema de diseño."
// Las pruebas que simulan un fallo terminan con `generate.mockReset()`: vitest marca como error una implementación que lanza si queda activa.
beforeEach(() => generate.mockReset())

describe("verificador de datos", () => {
  it("acepta texto hecho con los hechos del CV y la oferta", () => {
    expect(ungroundedTerms(good, corpus)).toEqual([])
    expect(isGroundedMiddle(good, input, "medio")).toBe(true)
  })
  it("rechaza cifras, años, herramientas y empresas inventadas", () => {
    expect(ungroundedTerms("Tengo 8 años de experiencia con Sketch en Google.", corpus)).toEqual(expect.arrayContaining(["8", "Sketch", "Google", "años de experiencia"]))
  })
  it("rechaza enlaces, correos, otro alfabeto y «vosotros»", () => {
    expect(ungroundedTerms("Mira mi web https://x.com", corpus)).toContain("enlace o correo")
    expect(ungroundedTerms("Soy diseñador 共同翻译", corpus)).toContain("texto en otro alfabeto")
    expect(ungroundedTerms("Contribuir a vuestro equipo", corpus)).toContain("vosotros")
  })
  it("el inicio de frase y las palabras comunes no cuentan como nombres propios", () => {
    expect(ungroundedTerms("Poseo experiencia en Figma. Estoy listo para aportar.", corpus)).toEqual([])
  })
  it("rechaza saludos, despedidas y largos fuera de rango", () => {
    expect(isGroundedMiddle(`Hola, equipo. ${good}`, input, "medio")).toBe(false)
    expect(isGroundedMiddle(`${good} Gracias.`, input, "medio")).toBe(false)
    expect(isGroundedMiddle("Uso Figma.", input, "largo")).toBe(false)
  })
})

describe("neutralize", () => {
  it("corrige «la área» y las formas con género más comunes", () => {
    expect(neutralize("Trabajé con la área de producto y la Área técnica.")).toBe("Trabajé con el área de producto y el Área técnica.")
    expect(neutralize("Estoy muy entusiasmado con la oportunidad. Estoy dispuesta a aprender.")).toBe("Me entusiasma la oportunidad. Tengo disposición para aprender.")
  })
  it("no toca el texto que ya está bien", () => {
    expect(neutralize("Me entusiasma el área de diseño.")).toBe("Me entusiasma el área de diseño.")
  })
})

describe("plantillas", () => {
  it("usan solo datos que existen y omiten las que no tienen dato", () => {
    const t = templateMiddles(input)
    expect(t).toHaveLength(3)
    expect(t.join(" ")).not.toMatch(/undefined|null|\{/)
    expect(templateMiddles({ ...input, covered: [], facts: { skills: [], roles: [], languages: [] } })).toEqual([])
  })
  it("cvFacts toma una lista corta y cerrada del CV", () => {
    const cv = { header: { fullName: "Ana", headline: "Product Designer", links: [] }, experience: [{ company: "Acme", role: "Diseñadora", startDate: "2020-01", bullets: [] }], education: [], skills: [{ items: ["Figma", "Sketch"] }], languages: [{ name: "Español" }], projects: [] } as unknown as CV
    expect(cvFacts(cv)).toEqual({ headline: "Product Designer", skills: ["Figma", "Sketch"], roles: [{ role: "Diseñadora", company: "Acme" }], languages: ["Español"] })
  })
})

describe("suggestBodies", () => {
  const settings = { length: "medio", tone: "cercano", focus: "variado" } as const
  it("hace una llamada por ángulo y se queda con las propuestas que pasan la verificación", async () => {
    const second = good.replace("Trabajé como", "Me desempeñé como")
    generate
      .mockResolvedValueOnce({ data: { text: good } })
      .mockResolvedValueOnce({ data: { text: "Tengo 10 años de experiencia con Sketch y Adobe en el diseño de productos digitales para empresas de varios sectores." } })
      .mockResolvedValueOnce({ data: { text: second } })
    const r = await suggestBodies(input, settings)
    expect(generate).toHaveBeenCalledTimes(3)
    expect(r.map((p) => p.source)).toEqual(["ia", "ia"])
    expect(r[0].middle).toBe(good)
    expect(r.every((p) => !/Sketch|10 años/.test(p.middle))).toBe(true)
  })
  it("con `angle` pide solo esa propuesta y, si falla, usa «su» plantilla", async () => {
    generate.mockResolvedValue({ data: { text: good } })
    const one = await suggestBodies(input, settings, [], undefined, 1)
    expect(generate).toHaveBeenCalledTimes(1)
    expect(one).toEqual([{ middle: good, source: "ia" }])
    generate.mockReset()
    generate.mockImplementation(async () => {
      throw new Error("sin Ollama")
    })
    const t = templateMiddles(input)
    expect(await suggestBodies(input, settings, [], undefined, 0)).toEqual([{ middle: t[0], source: "plantilla" }])
    expect(await suggestBodies(input, settings, [], undefined, 2)).toEqual([{ middle: t[2], source: "plantilla" }])
    generate.mockReset()
  })
  it("con un enfoque elegido, los 3 ángulos son el mismo", async () => {
    generate.mockResolvedValue({ data: { text: good } })
    await suggestBodies(input, { ...settings, focus: "habilidades" })
    const systems = generate.mock.calls.map((c) => c[0].system as string)
    expect(systems).toHaveLength(3)
    expect(systems.every((s) => s.includes("destaca las habilidades y herramientas"))).toBe(true)
  })
  it("si el modelo falla, solo hay plantillas", async () => {
    generate.mockImplementation(async () => {
      throw new Error("sin Ollama")
    })
    const r = await suggestBodies(input, settings)
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((p) => p.source === "plantilla")).toBe(true)
    generate.mockReset()
  })
  it("no repite propuestas ya mostradas", async () => {
    generate.mockResolvedValue({ data: { text: good } })
    const r = await suggestBodies(input, settings, [good, templateMiddles(input)[0]])
    expect(r.map((p) => p.middle)).not.toContain(good)
    expect(r.map((p) => p.middle)).not.toContain(templateMiddles(input)[0])
  })
})
