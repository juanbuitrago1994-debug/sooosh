import { beforeEach, describe, expect, it, vi } from "vitest"

const generate = vi.fn()
vi.mock("@/lib/ai", () => ({ getProvider: () => ({ generateStructured: generate }) }))

import { isGroundedSubject, suggestSubject, templateSubjects } from "@/lib/apply/subject-ai"

const input = { title: "Diseñador/a UX/UI", company: "Vos Consultora", name: "Ana Pérez" }

// Los tests que simulan un fallo terminan con `generate.mockReset()`: vitest reporta como error de la prueba una implementación que lanza si queda activa al terminar.
beforeEach(() => generate.mockReset())

describe("verificador", () => {
  it("acepta asuntos hechos con el cargo, la empresa, el nombre y vocabulario de postulación", () => {
    expect(isGroundedSubject("Postulación a Diseñador/a UX/UI en Vos Consultora – Ana Pérez", input)).toBe(true)
    expect(isGroundedSubject("Ana Pérez – Candidatura para Diseñador/a UX/UI", input)).toBe(true)
  })
  it("rechaza datos que no salen de la oferta ni del CV", () => {
    expect(isGroundedSubject("Postulación Diseñador/a UX/UI – 8 años con Sketch", input)).toBe(false)
    expect(isGroundedSubject("Postulación a Diseñador/a UX/UI en Google", input)).toBe(false)
  })
  it("rechaza formatos raros: muy corto, muy largo, saltos, correos, enlaces, emojis", () => {
    for (const s of ["Hola", "Postulación ".repeat(10), "Postulación\nUX/UI", "Postulación ana@x.com", "Postulación UX/UI https://x.com", "Postulación UX/UI 🚀"]) expect(isGroundedSubject(s, input)).toBe(false)
  })
})

describe("plantillas", () => {
  it("omiten empresa y nombre si faltan, sin inventar", () => {
    const t = templateSubjects({ title: "Analista" })
    expect(t[0]).toBe("Postulación: Analista")
    expect(t.join(" ")).not.toMatch(/undefined|null|\{/)
  })
  it("traen varias variantes distintas", () => {
    const t = templateSubjects(input)
    expect(new Set(t).size).toBe(t.length)
    expect(t.length).toBeGreaterThanOrEqual(4)
  })
})

describe("suggestSubject", () => {
  it("usa el asunto del modelo si pasa la verificación", async () => {
    generate.mockResolvedValue({ data: { subject: "Candidatura a Diseñador/a UX/UI en Vos Consultora" } })
    expect(await suggestSubject(input)).toEqual({ subject: "Candidatura a Diseñador/a UX/UI en Vos Consultora", source: "ia" })
  })
  it("si el modelo inventa datos, cae a la plantilla", async () => {
    generate.mockResolvedValue({ data: { subject: "Postulación Diseñador/a UX/UI – experto en Sketch" } })
    expect((await suggestSubject(input)).source).toBe("plantilla")
  })
  it("sin Ollama (error), cae a la plantilla", async () => {
    generate.mockImplementation(async () => {
      throw new Error("sin Ollama")
    })
    expect(await suggestSubject(input)).toEqual({ subject: templateSubjects(input)[0], source: "plantilla" })
    generate.mockReset()
  })
  it("no repite asuntos ya usados", async () => {
    generate.mockImplementation(async () => {
      throw new Error("sin Ollama")
    })
    const first = templateSubjects(input)
    const r = await suggestSubject(input, [first[0], first[1]])
    expect(r.subject).toBe(first[2])
    generate.mockResolvedValue({ data: { subject: first[0] } })
    expect((await suggestSubject(input, [first[0]])).subject).not.toBe(first[0])
  })
  it("si ya se usaron todas, vuelve a empezar", async () => {
    generate.mockImplementation(async () => {
      throw new Error("sin Ollama")
    })
    const all = templateSubjects(input)
    expect((await suggestSubject(input, all)).subject).toBe(all[0])
    generate.mockReset()
  })
})
