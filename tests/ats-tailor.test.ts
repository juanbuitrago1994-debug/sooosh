import { describe, expect, it } from "vitest"
import { tailorCv } from "@/lib/ats/tailor"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema } from "@/lib/schemas/offer"

const cv = cvSchema.parse({
  header: { fullName: "Ana Zapata" },
  summary: "Diseñadora.",
  skills: [
    { category: "Gestión", items: ["Jira", "Scrum"] },
    { category: "Diseño", items: ["Illustrator", "Figma", "Prototipado"] },
  ],
  experience: [
    { company: "A", role: "Diseñadora", startDate: "2022", endDate: "2024", bullets: ["Organicé talleres de equipo", "Diseñé prototipos en Figma para la app móvil"] },
    { company: "B", role: "Junior", startDate: "2019", endDate: "2022", bullets: ["Apoyé a QA"] },
  ],
})
const offer = offerSchema.parse({ title: "Product Designer", language: "es", requirements: ["Experiencia con Figma y prototipado"], tools: ["Figma"], niceToHave: [], responsibilities: [] })

describe("adaptar el CV a la oferta (solo ordena, nunca inventa)", () => {
  const out = tailorCv(cv, offer)
  it("sube primero las habilidades y los grupos que pide la oferta", () => {
    expect(out.cv.skills[0].category).toBe("Diseño")
    expect(out.cv.skills[0].items[0]).toBe("Figma")
    expect(out.report.skillsMoved).toBeGreaterThan(0)
  })
  it("dentro de cada experiencia, el logro más relevante va primero; las experiencias no cambian de orden", () => {
    expect(out.cv.experience[0].bullets[0]).toContain("Figma")
    expect(out.cv.experience.map((e) => e.company)).toEqual(["A", "B"])
    expect(out.report.bulletsMoved).toBe(2)
  })
  it("no quita, agrega ni reescribe nada: mismos elementos, mismo resumen", () => {
    const flat = (c: typeof cv) => [...c.skills.flatMap((g) => g.items), ...c.experience.flatMap((e) => e.bullets)].sort()
    expect(flat(out.cv)).toEqual(flat(cv))
    expect(out.cv.summary).toBe(cv.summary)
    expect(out.cv.header).toEqual(cv.header)
  })
  it("una oferta sin coincidencias deja el CV igual", () => {
    const none = tailorCv(cv, offerSchema.parse({ title: "Chef", language: "es", requirements: ["cocina italiana"], niceToHave: [], responsibilities: [] }))
    expect(none.cv).toEqual(cv)
    expect(none.report).toEqual({ skillsMoved: 0, bulletsMoved: 0 })
  })
})
