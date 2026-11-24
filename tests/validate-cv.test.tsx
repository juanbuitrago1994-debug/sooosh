import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ValidationFlow } from "@/components/cv/validation-flow"
import { applyStage, flatSkills, roleSuggestions } from "@/lib/cv/validate"
import { cvSchema } from "@/lib/schemas/cv"

const cv = cvSchema.parse({
  header: { fullName: "Ana Zapata", headline: "Product Designer", email: "ana@x.co", phone: "+57 300 000 0000", location: "Bogotá" },
  summary: "Diseñadora.",
  skills: [{ category: "Diseño", items: ["Figma", "UX"] }, { items: ["figma", "Jira"] }],
  languages: [{ name: "Español", level: "Nativo" }],
  experience: [
    { company: "A", role: "Product Designer", startDate: "2020" },
    { company: "B", role: "UX Designer", startDate: "2018" },
  ],
})

describe("validación del CV (F1)", () => {
  it("sugiere solo cargos que ya están en el CV, sin repetir", () => {
    expect(roleSuggestions(cv)).toEqual(["Product Designer", "UX Designer"])
    expect(roleSuggestions(cvSchema.parse({ header: { fullName: "Ana" } }))).toEqual([])
  })
  it("applyStage cambia solo el dato de la etapa", () => {
    const next = applyStage(cv, "name", { name: "  Ana María Zapata " })
    expect(next.header.fullName).toBe("Ana María Zapata")
    expect(next.header.email).toBe("ana@x.co")
    expect(applyStage(cv, "name", { name: "  " }).header.fullName).toBe("Ana Zapata")
    expect(applyStage(cv, "contact", { email: "", phone: "1", location: "" }).header).toMatchObject({ email: undefined, phone: "1", location: undefined })
  })
  it("pantalla dividida: archivo a la izquierda y la primera pregunta a la derecha", () => {
    const html = renderToStaticMarkup(<ValidationFlow cv={cv} file={{ name: "cv.pdf", detail: "PDF · 1 MB · leído en 2 s", notes: [] }} onChange={() => {}} onChangeFile={() => {}} />)
    expect(html).toContain("md:grid-cols-2")
    expect(html).toContain("cv.pdf")
    expect(html).toContain("PDF · 1 MB")
    expect(html).toContain("Identificamos este nombre. ¿Es correcto?")
    expect(html).toContain("Ana Zapata")
    expect(html).toContain("Es correcto")
    expect(html).toContain("No es correcto")
  })
  it("F2: habilidades sin repetir; quitar descarta, agregar crea un grupo propio; resumen e idiomas se corrigen", () => {
    expect(flatSkills(cv)).toEqual(["Figma", "UX", "Jira"])
    const next = applyStage(cv, "skills", { skills: ["Figma", "Jira", "Research"] })
    expect(next.skills.map((g) => g.items)).toEqual([["Figma"], ["Jira"], ["Research"]])
    expect(applyStage(cv, "summary", { summary: "  " }).summary).toBeUndefined()
    expect(applyStage(cv, "languages", { languages: [{ name: "Inglés", level: "B2" }, { name: " " }] }).languages).toEqual([{ name: "Inglés", level: "B2" }])
  })
})
