import { describe, expect, it } from "vitest"
import { emptyCv, filledSections, mergeCv } from "@/lib/cv/merge"
import type { CV } from "@/lib/schemas/cv"

const incoming: CV = {
  ...emptyCv(),
  header: { fullName: "Ana Pérez", headline: "Diseñadora", email: "ana@mail.com", phone: "+57 300", location: "Bogotá", links: [{ label: "LinkedIn", url: "linkedin.com/in/ana" }] },
  summary: "Diseñadora con 5 años.",
  experience: [{ company: "Acme", role: "Diseñadora", startDate: "2020", bullets: ["Rediseñé el pago"] }],
  certifications: [{ name: "Google UX" }],
}

describe("llenar con tu CV", () => {
  it("llena un perfil vacío con todo lo leído", () => {
    const r = mergeCv(emptyCv(), incoming)
    expect(r.header.fullName).toBe("Ana Pérez")
    expect(r.experience).toHaveLength(1)
    expect(filledSections(emptyCv(), r)).toEqual(expect.arrayContaining(["datos personales", "resumen", "experiencia", "certificaciones"]))
  })
  it("nunca pisa lo que la persona ya escribió", () => {
    const mine: CV = { ...emptyCv(), header: { fullName: "Ana P.", email: "otra@mail.com", links: [] }, summary: "Mi resumen", experience: [{ company: "Mi empresa", role: "Líder", startDate: "2022", bullets: [] }] }
    const r = mergeCv(mine, incoming)
    expect(r.header.fullName).toBe("Ana P.")
    expect(r.header.email).toBe("otra@mail.com")
    expect(r.header.phone).toBe("+57 300") // lo vacío sí se llena
    expect(r.summary).toBe("Mi resumen")
    expect(r.experience).toEqual(mine.experience)
    expect(r.certifications).toHaveLength(1)
  })
  it("el marcador «Sin nombre» no cuenta como nombre y los enlaces no se duplican", () => {
    const mine: CV = { ...emptyCv(), header: { fullName: "Sin nombre", links: [{ label: "in", url: "LinkedIn.com/in/ana" }] } }
    const r = mergeCv(mine, incoming)
    expect(r.header.fullName).toBe("Ana Pérez")
    expect(r.header.links).toHaveLength(1)
  })
  it("tolera un CV leído sin las listas nuevas (no se rompe con undefined)", () => {
    const legacy = { header: { fullName: "Ana Pérez", links: [] }, experience: [], education: [], skills: [], languages: [], projects: [] } as unknown as CV
    const r = mergeCv(emptyCv(), legacy)
    expect(r.certifications).toEqual([])
    expect(() => filledSections(emptyCv(), r)).not.toThrow()
    expect(() => filledSections(emptyCv(), legacy)).not.toThrow()
  })
})
