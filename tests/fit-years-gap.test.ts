import { describe, expect, it } from "vitest"
import { computeFit } from "@/lib/analysis/fit"
import { proposeGaps } from "@/lib/changes/propose"
import { cvSchema } from "@/lib/schemas/cv"
import { offerSchema } from "@/lib/schemas/offer"

const cv = (start: string) =>
  cvSchema.parse({
    header: { fullName: "Ana" },
    experience: [{ company: "A", role: "Product Designer", startDate: start, endDate: "Actual", bullets: ["Diseñé prototipos en Figma"] }],
    skills: [{ items: ["Figma"] }],
  })
const offer = offerSchema.parse({
  title: "Product Designer",
  language: "es",
  requirements: ["3 o más años de experiencia diseñando productos digitales", "Dominio de Figma"],
  niceToHave: [],
  responsibilities: [],
  yearsExperience: { min: 3 },
})

describe("«No está en tu CV» y los años de experiencia", () => {
  it("si los años del CV alcanzan el mínimo, el requisito de años no figura como faltante", () => {
    const gaps = computeFit(cv("2016"), offer).gaps.map((g) => g.label)
    expect(gaps.some((g) => /a[ñn]os/i.test(g))).toBe(false)
  })
  it("si no alcanzan, sí figura", () => {
    const gaps = computeFit(cv("2026"), offer).gaps.map((g) => g.label)
    expect(gaps.some((g) => /a[ñn]os/i.test(g))).toBe(true)
  })
})

describe("brechas que se le preguntan a la persona", () => {
  it("incluyen habilidades transversales y deseables, no solo técnicas obligatorias; nunca se rellenan solas", () => {
    const o = offerSchema.parse({
      title: "Product Designer",
      language: "es",
      requirements: ["Dominio de Figma", "Comunicación clara y trabajo en equipo"],
      niceToHave: ["metodologías ágiles (Scrum)"],
      responsibilities: [],
      yearsExperience: { min: 3 },
      softSkills: ["comunicación", "trabajo en equipo"],
    })
    const gaps = proposeGaps(computeFit(cv("2016"), o))
    const labels = gaps.map((g) => g.label)
    expect(labels).toEqual(expect.arrayContaining(["Falta: Comunicación", "Falta: Trabajo en equipo", "Falta: Metodologías ágiles"]))
    // lo obligatorio va antes que lo deseable
    expect(labels.indexOf("Falta: Metodologías ágiles")).toBeGreaterThan(labels.indexOf("Falta: Comunicación"))
    for (const g of gaps) expect(g).toMatchObject({ type: "brecha", userProvided: true, proposed: "" })
    expect(gaps.find((g) => g.label === "Falta: Comunicación")!.question).toContain("no lo agregamos por ti")
  })
})
