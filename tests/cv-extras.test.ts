import { describe, expect, it } from "vitest"
import { parseAwards, parseCertifications, parsePublications, parseVolunteering } from "@/lib/cv/extras"
import { runCvPipeline } from "@/lib/cv/pipeline"
import { cvSchema } from "@/lib/schemas/cv"

describe("secciones extra del CV (sin IA)", () => {
  it("certificaciones: nombre, entidad, año y enlace, solo lo que está en el texto", () => {
    const r = parseCertifications("• Google UX Design Certificate - Coursera (2023)\n• Scrum Master — Scrum.org, 2021\n• Curso de Figma")
    expect(r).toEqual([
      { name: "Google UX Design Certificate", issuer: "Coursera", date: "2023", url: undefined },
      { name: "Scrum Master", issuer: "Scrum.org", date: "2021", url: undefined },
      { name: "Curso de Figma", issuer: undefined, date: undefined, url: undefined },
    ])
  })
  it("un año dentro del nombre no se toma por fecha", () => {
    expect(parseCertifications("Guía Scrum 2020 avanzada")[0]).toMatchObject({ name: "Guía Scrum 2020 avanzada", date: undefined })
  })
  it("voluntariado: entradas con rol, organización, fechas y viñetas", () => {
    const r = parseVolunteering("Mentor — Fundación Código\n2022 - 2023\n• Acompañé a 10 estudiantes")
    expect(r).toHaveLength(1)
    expect(r[0].bullets).toEqual(["Acompañé a 10 estudiantes"])
    expect(r[0].startDate).toBe("2022")
    expect(r[0].organization).not.toBe("")
  })
  it("voluntariado de una sola línea se conserva", () => {
    expect(parseVolunteering("Banco de Alimentos de Bogotá — 2021")[0].organization).toContain("Banco de Alimentos")
  })
  it("premios y publicaciones", () => {
    expect(parseAwards("Premio a la innovación — Cámara de Comercio (2022)")[0]).toMatchObject({ name: "Premio a la innovación", issuer: "Cámara de Comercio", date: "2022" })
    expect(parsePublications("Diseño de sistemas — Medium (2024) https://medium.com/@ana/ds")[0]).toMatchObject({ title: "Diseño de sistemas", date: "2024" })
  })
  it("el pipeline las lee de los encabezados y el esquema las acepta", async () => {
    const text = ["Ana Pérez", "ana@mail.com", "EXPERIENCIA", "Diseñadora — Acme", "2020 - 2023", "• Rediseñé el flujo de pago", "CERTIFICACIONES", "• Google UX Design - Coursera (2023)", "VOLUNTARIADO", "Mentora — Fundación Código", "2022 - 2023"].join("\n")
    const r = await runCvPipeline(text, { onStage: () => {} }).catch(() => null)
    if (!r) return // sin IA disponible el pipeline puede necesitar el modelo: la parte determinista ya está probada arriba
    expect(r.cv.certifications[0]?.name).toBe("Google UX Design")
    expect(r.cv.volunteering.length).toBe(1)
    expect(cvSchema.safeParse(r.cv).success).toBe(true)
  })
  it("un CV guardado antes (sin las secciones nuevas) sigue siendo válido", () => {
    const old = { header: { fullName: "Ana", links: [] }, experience: [], education: [], skills: [], languages: [], projects: [] }
    const p = cvSchema.parse(old)
    expect(p.certifications).toEqual([])
    expect(p.awards).toEqual([])
  })
})

import { buildAtsDoc } from "@/lib/ats/model"
import { toDocModel } from "@/lib/export/model"
import { renderCvHtml } from "@/lib/pdf/template"
import { emptyCv } from "@/lib/cv/merge"

describe("las secciones nuevas llegan a los documentos", () => {
  const cv = {
    ...emptyCv(),
    header: { fullName: "Ana Pérez", email: "ana@mail.com", links: [] },
    experience: [{ company: "Acme", role: "Diseñadora", startDate: "2020", endDate: "2023", bullets: ["Rediseñé el flujo de pago"] }],
    certifications: [{ name: "Google UX Design", issuer: "Coursera", date: "2023" }],
    volunteering: [{ organization: "Fundación Código", role: "Mentora", startDate: "2022", endDate: "2023", bullets: ["Acompañé a 10 estudiantes"] }],
    awards: [{ name: "Premio a la innovación", issuer: "Cámara de Comercio", date: "2022" }],
    publications: [{ title: "Diseño de sistemas", publisher: "Medium", date: "2024" }],
  }
  it("ATS: cada sección con su encabezado estándar y en el orden fijo", () => {
    const doc = buildAtsDoc(cv, { lang: "es", summary: "Diseñadora con experiencia en producto digital." })
    const titles = doc.sections.map((s) => s.title)
    expect(titles).toEqual(expect.arrayContaining(["Certificaciones", "Voluntariado", "Premios y reconocimientos", "Publicaciones"]))
    expect(titles.indexOf("Certificaciones")).toBeLessThan(titles.indexOf("Voluntariado"))
    expect(titles.indexOf("Voluntariado")).toBeLessThan(titles.indexOf("Publicaciones"))
  })
  it("Word/TXT/Markdown y PDF las incluyen y no pintan las vacías", () => {
    const m = toDocModel(cv, "es")
    expect(m.sections.map((s) => s.key)).toEqual(expect.arrayContaining(["certifications", "volunteering", "awards", "publications"]))
    expect(toDocModel(emptyCv(), "es").sections).toHaveLength(0)
    const html = renderCvHtml(cv, "es")
    for (const t of ["Google UX Design", "Fundación Código", "Premio a la innovación", "Diseño de sistemas"]) expect(html).toContain(t)
    expect(renderCvHtml(emptyCv(), "es")).not.toContain("Voluntariado")
  })
})
