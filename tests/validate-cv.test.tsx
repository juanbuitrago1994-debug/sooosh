import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ValidationFlow } from "@/components/cv/validation-flow"
import { applyStage, dropStage, entryLine, flatSkills, removeEntry, roleSuggestions, stagesFor } from "@/lib/cv/validate"
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
    const next = applyStage(cv, { kind: "name" }, { name: "  Ana María Zapata " })
    expect(next.header.fullName).toBe("Ana María Zapata")
    expect(next.header.email).toBe("ana@x.co")
    expect(applyStage(cv, { kind: "name" }, { name: "  " }).header.fullName).toBe("Ana Zapata")
    expect(applyStage(cv, { kind: "contact" }, { email: "", phone: "1", location: "" }).header).toMatchObject({ email: undefined, phone: "1", location: undefined })
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
    const next = applyStage(cv, { kind: "skills" }, { skills: ["Figma", "Jira", "Research"] })
    expect(next.skills.map((g) => g.items)).toEqual([["Figma"], ["Jira"], ["Research"]])
    expect(applyStage(cv, { kind: "summary" }, { summary: "  " }).summary).toBeUndefined()
    expect(applyStage(cv, { kind: "languages" }, { languages: [{ name: "Inglés", level: "B2" }, { name: " " }] }).languages).toEqual([{ name: "Inglés", level: "B2" }])
  })
  it("F3: una etapa por cada experiencia y estudio; corregir una no toca las demás; quitar baja las siguientes", () => {
    const full = cvSchema.parse({
      header: { fullName: "Ana" },
      experience: [
        { company: "A", role: "Diseñadora", startDate: "2020", endDate: "2022", bullets: ["x"] },
        { company: "B", role: "UX", startDate: "2018", bullets: [] },
      ],
      education: [{ institution: "U Nacional", degree: "Diseño", startDate: "2012", endDate: "2017" }],
    })
    const st = stagesFor(full)
    expect(st.map((s) => `${s.kind}${s.idx ?? ""}`)).toEqual(["name", "role", "contact", "summary", "experience0", "experience1", "education0", "skills", "languages"])
    expect(entryLine(full, st[4])).toBe("Diseñadora · A · 2020 – 2022")
    expect(entryLine(full, st[6])).toBe("Diseño · U Nacional · 2012 – 2017")
    const fixed = applyStage(full, st[5], { experience: { role: "UX Designer", company: "B", startDate: "2018", endDate: "", location: "", bullets: ["a", " ", "b"] } })
    expect(fixed.experience[1]).toMatchObject({ role: "UX Designer", bullets: ["a", "b"] })
    expect(fixed.experience[0]).toEqual(full.experience[0])
    expect(applyStage(full, st[5], { experience: { role: "", company: "B", startDate: "" , bullets: [] } })).toBe(full)
    expect(removeEntry(full, st[4]).experience.map((e) => e.company)).toEqual(["B"])
    expect(dropStage(st, 4).filter((s) => s.kind === "experience")).toEqual([{ kind: "experience", idx: 0 }])
  })
})

describe("avisos con modales de shadcn (no del navegador)", () => {
  it("el texto de «Cambiar CV» avisa de las afinidades y de que los CV generados se conservan", async () => {
    const { CHANGE_CV_COPY } = await import("@/components/cv/change-cv-dialog")
    expect(CHANGE_CV_COPY.description).toContain("afinidades")
    expect(CHANGE_CV_COPY.description).toContain("Tus CV por oferta")
  })
})
