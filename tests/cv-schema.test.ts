import { describe, expect, it } from "vitest"
import { cleanEmpty, toModelSchema } from "@/lib/ai/json-schema"
import { cvSchema } from "@/lib/schemas/cv"

const minimal = { header: { fullName: "Ana Torres" } }

describe("cvSchema", () => {
  it("acepta un CV mínimo y rellena las listas vacías", () => {
    const cv = cvSchema.parse(minimal)
    expect(cv.experience).toEqual([])
    expect(cv.skills).toEqual([])
    expect(cv.header.links).toEqual([])
  })

  it("acepta un CV completo", () => {
    const cv = cvSchema.parse({
      header: { fullName: "Ana", email: "a@b.co", links: [{ label: "LinkedIn", url: "linkedin.com/in/ana" }] },
      summary: "Resumen",
      experience: [{ company: "Acme", role: "Dev", startDate: "Mar 2021", endDate: "Actual", bullets: ["Hice X"] }],
      education: [{ institution: "UN", degree: "Ing." }],
      skills: [{ category: "Lenguajes", items: ["TypeScript"] }],
      languages: [{ name: "Inglés", level: "B2" }],
      projects: [{ name: "P", technologies: ["Next.js"] }],
    })
    expect(cv.experience[0].bullets).toHaveLength(1)
  })

  it("exige nombre", () => {
    expect(cvSchema.safeParse({ header: {} }).success).toBe(false)
    expect(cvSchema.safeParse({ header: { fullName: "  " } }).success).toBe(false)
  })

  it("exige empresa y cargo en cada experiencia", () => {
    const r = cvSchema.safeParse({ ...minimal, experience: [{ company: "Acme", startDate: "2020" }] })
    expect(r.success).toBe(false)
  })

  it("rechaza un grupo de skills sin elementos", () => {
    expect(cvSchema.safeParse({ ...minimal, skills: [{ items: [] }] }).success).toBe(false)
  })
})

describe("helpers del modelo", () => {
  it("cleanEmpty quita vacíos y null pero conserva arrays", () => {
    expect(cleanEmpty({ a: "", b: null, c: "x", d: [], e: { f: " " } })).toEqual({ c: "x", d: [], e: {} })
  })

  it("el JSON Schema para Ollama no lleva restricciones que la gramática maneje mal", () => {
    const json = JSON.stringify(toModelSchema(cvSchema))
    expect(json).not.toMatch(/"(pattern|format|maxLength|minLength|\$schema)"/)
    expect(json).toContain('"fullName"')
  })
})
