import { describe, expect, it } from "vitest"
import { isRich, mergeEnriched } from "@/lib/enrich/merge"
import { externalToDraft } from "@/lib/sources/normalize"
import { mapGreenhouseJob } from "@/lib/sources/adapters/greenhouse"
import { offerSchema } from "@/lib/schemas/offer"

const base = (over: object = {}) => offerSchema.parse({ title: "Analista", company: "Acme", language: "es", requirements: [], niceToHave: [], responsibilities: [], ...over })

describe("mezcla de lo que sacó la IA con lo que ya había", () => {
  it("llena las listas vacías y no pisa las que ya estaban bien", () => {
    const cur = base({ requirements: ["SQL avanzado"], responsibilities: [] })
    const ext = base({ requirements: ["Otra cosa"], responsibilities: ["Construir reportes", "Dar soporte"], niceToHave: ["Python"] })
    const { offer, added } = mergeEnriched(cur, ext)
    expect(offer.requirements).toEqual(["SQL avanzado"])
    expect(offer.responsibilities).toEqual(["Construir reportes", "Dar soporte"])
    expect(offer.niceToHave).toEqual(["Python"])
    expect(added).toBe(3)
  })
  it("título y empresa no cambian; herramientas se suman sin repetir; años y nivel solo si faltaban", () => {
    const cur = base({ tools: ["SQL"], yearsExperience: { min: 3 }, seniority: "senior" })
    const ext = base({ title: "Otro título", company: "Otra", tools: ["SQL", "Python"], yearsExperience: { min: 1 }, seniority: "junior" })
    const { offer } = mergeEnriched(cur, ext)
    expect(offer).toMatchObject({ title: "Analista", company: "Acme", tools: ["SQL", "Python"], yearsExperience: { min: 3 }, seniority: "senior" })
    const { offer: o2 } = mergeEnriched(base(), ext)
    expect(o2).toMatchObject({ yearsExperience: { min: 1 }, seniority: "junior" })
  })
  it("una oferta es «rica» con 2 o más requisitos o tareas", () => {
    expect(isRich(base())).toBe(false)
    expect(isRich(base({ requirements: ["a", "b"] }))).toBe(true)
    expect(isRich(base({ tools: ["SQL", "Python", "Excel"] }))).toBe(false) // solo herramientas sueltas: aún conviene estructurarla
  })
})

describe("la sincronización entrega el texto para la cola", () => {
  it("devuelve el texto plano junto a la tarjeta, y la oferta sin listas queda «pobre»", () => {
    const j = mapGreenhouseJob({ id: 1, title: "Marketplace Analyst", absolute_url: "https://job-boards.greenhouse.io/cabify/jobs/1", location: { name: "Bogotá" }, content: "&lt;p&gt;" + "Buscamos a alguien que apoye al equipo de marketplace con análisis de datos y reportes semanales. ".repeat(3) + "&lt;/p&gt;" }, "cabify", "Cabify")!
    const n = externalToDraft(j)!
    expect(n.text.length).toBeGreaterThan(200)
    expect(isRich(n.draft.offer)).toBe(false)
  })
})
