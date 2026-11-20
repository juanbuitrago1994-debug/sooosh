import { renderToString } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CvForm } from "@/components/cv/cv-form"
import { cvSchema } from "@/lib/schemas/cv"

describe("CvForm", () => {
  it("renderiza las siete secciones sin romperse (bullets y skills incluidos)", () => {
    const cv = cvSchema.parse({
      header: { fullName: "Ana Torres", email: "ana@example.com" },
      experience: [{ company: "Acme", role: "Dev", startDate: "2021", bullets: ["Hice X", "Hice Y"] }],
      skills: [{ items: ["TypeScript", "Node.js"] }],
    })
    const html = renderToString(<CvForm initial={cv} onSubmit={() => {}} />)
    for (const title of ["Cabecera", "Resumen", "Experiencia", "Educación", "Skills", "Idiomas", "Proyectos"]) {
      expect(html).toContain(title)
    }
    expect(html).toContain("Hice Y")
    expect(html).toContain("TypeScript, Node.js")
    expect(html).toContain('id="cv-form"')
  })
})
