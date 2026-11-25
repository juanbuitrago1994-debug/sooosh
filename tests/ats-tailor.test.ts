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

describe("resumen orientado a la oferta", () => {
  const stub = (text: string) => ({ generateStructured: async () => ({ data: { summary: text } }) }) as never
  it("acepta un resumen hecho solo con datos del CV, y se le pasa el cargo objetivo", async () => {
    const { generateSummary } = await import("@/lib/ats/summary")
    let seen = ""
    const provider = { generateStructured: async (a: { user: string }) => ((seen = a.user), { data: { summary: "Diseñadora con experiencia en prototipado y Figma. Participa en pruebas de usabilidad de apps móviles." } }) } as never
    const cv2 = cvSchema.parse({ header: { fullName: "Ana", headline: "Diseñadora" }, skills: [{ items: ["Figma", "Prototipado"] }], experience: [{ company: "A", role: "Diseñadora", startDate: "2020", bullets: ["Pruebas de usabilidad de apps móviles"] }] })
    const r = await generateSummary(cv2, "es", { provider, focus: "Product Designer" })
    expect(r.summary).toContain("Figma")
    expect(JSON.parse(seen).targetRole).toBe("Product Designer")
  })
  it("descarta un resumen que inventa herramientas o cifras", async () => {
    const { generateSummary } = await import("@/lib/ats/summary")
    const cv2 = cvSchema.parse({ header: { fullName: "Ana", headline: "Diseñadora" }, skills: [{ items: ["Figma"] }], experience: [{ company: "A", role: "Diseñadora", startDate: "2020", bullets: [] }] })
    const r = await generateSummary(cv2, "es", { provider: stub("Diseñadora con 12 años de experiencia en Sketch y Photoshop. Lideró equipos de 40 personas."), focus: "Product Designer" })
    expect(r.summary).toBeNull()
    expect(["no-paso-verificacion", "forma"]).toContain(r.reason)
  })
})
