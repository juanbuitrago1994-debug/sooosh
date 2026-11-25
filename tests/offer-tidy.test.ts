import { describe, expect, it } from "vitest"
import { isSectorNotCompany, tidyOffer } from "@/lib/offer/tidy"
import { offerSchema } from "@/lib/schemas/offer"

const SOURCE = "Product Designer – Fintech (Bogotá, híbrido)\nBuscamos un/a Product Designer para unirse al equipo de una fintech en crecimiento.\nSe valora: experiencia en banca o seguros, pruebas A/B, metodologías ágiles (Scrum).\nContrato indefinido, modalidad híbrida."

describe("limpieza final de la oferta", () => {
  it("un sector o una descripción no es la empresa; una empresa real sí", () => {
    expect(isSectorNotCompany("Fintech", SOURCE)).toBe(true)
    expect(isSectorNotCompany("Banca", "Trabajarás en banca digital")).toBe(true)
    expect(isSectorNotCompany("Rappi", "Rappi busca un Product Designer. Somos una fintech en crecimiento.")).toBe(false)
    expect(isSectorNotCompany("Nubank", "Únete a Nubank")).toBe(false)
  })
  it("quita rótulos, duplicados, condiciones del contrato y puntos finales; separa la enumeración de deseables", () => {
    const o = tidyOffer(
      offerSchema.parse({
        title: "Product Designer",
        company: "Fintech",
        language: "es",
        requirements: ["3 o más años de experiencia diseñando productos digitales.", "Dominio de Figma y prototipado."],
        niceToHave: ["Se valora: experiencia en banca o seguros, pruebas A/B, metodologías ágiles (Scrum).", "experiencia en banca o seguros, pruebas A/B, metodologías ágiles (Scrum).", "Contrato indefinido, modalidad híbrida."],
        responsibilities: ["Diseñar flujos en Figma.", "Diseñar flujos en Figma"],
      }),
      SOURCE,
    )
    expect(o.company).toBeUndefined()
    expect(o.requirements).toEqual(["3 o más años de experiencia diseñando productos digitales", "Dominio de Figma y prototipado"])
    expect(o.niceToHave).toEqual(["experiencia en banca o seguros", "pruebas A/B", "metodologías ágiles (Scrum)"])
    expect(o.responsibilities).toEqual(["Diseñar flujos en Figma"])
  })
  it("no toca una oferta que ya está limpia", () => {
    const o = offerSchema.parse({ title: "Analista", company: "Globex", language: "es", requirements: ["SQL avanzado"], niceToHave: ["Power BI"], responsibilities: ["Automatizar reportes"] })
    expect(tidyOffer(o, "Globex busca analista")).toEqual(o)
  })
  it("saca los años pedidos del requisito si el modelo no los sacó (solo con cifra explícita)", () => {
    const base = { title: "Diseñador", language: "es" as const, niceToHave: [], responsibilities: [] }
    expect(tidyOffer(offerSchema.parse({ ...base, requirements: ["3 o más años de experiencia diseñando productos digitales."] }), "x").yearsExperience).toEqual({ min: 3 })
    expect(tidyOffer(offerSchema.parse({ ...base, requirements: ["Amplia experiencia en diseño"] }), "x").yearsExperience).toBeUndefined()
    expect(tidyOffer(offerSchema.parse({ ...base, yearsExperience: { min: 5 }, requirements: ["3 años de Figma"] }), "x").yearsExperience).toEqual({ min: 5 })
  })
})
