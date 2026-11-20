import mammoth from "mammoth"
import { describe, expect, it } from "vitest"
import { POST } from "@/app/api/export/route"
import { toDocx, toMarkdown, toText } from "@/lib/export/formats"
import { toDocModel } from "@/lib/export/model"
import { cvFileName } from "@/lib/pdf/filename"
import type { CV } from "@/lib/schemas/cv"
import { strong } from "./fixtures/fit-cases"

const cv: CV = { ...strong, sectionOrder: ["skills", "summary", "experience", "education", "languages", "projects"] }
const strings = (c: CV): string[] => [c.header.fullName, c.header.headline!, c.header.email!, c.summary!, ...c.experience.flatMap((e) => [e.role, e.company, e.startDate, ...e.bullets]), ...c.education.map((e) => e.degree!), ...c.skills.flatMap((g) => g.items)]

describe("exportación en varios formatos (K7)", () => {
  it("el modelo común respeta el orden de secciones elegido", () => {
    expect(toDocModel(cv).sections.map((s) => s.key)).toEqual(["skills", "summary", "experience", "education", "languages"])
    expect(toDocModel(strong).sections.map((s) => s.key)).toEqual(["summary", "experience", "education", "skills", "languages"])
  })
  it("TXT: títulos en mayúsculas, viñetas con guion, orden elegido y nada de texto propio", () => {
    const t = toText(cv)
    expect(t.indexOf("HABILIDADES")).toBeLessThan(t.indexOf("RESUMEN"))
    expect(t.indexOf("RESUMEN")).toBeLessThan(t.indexOf("EXPERIENCIA"))
    expect(t).toContain(`- ${cv.experience[0].bullets[0]}`)
    expect(t.split("\n")[0]).toBe("Ana Torres")
    for (const s of strings(cv)) expect(t).toContain(s)
  })
  it("Markdown: títulos, entradas y viñetas", () => {
    const m = toMarkdown(cv)
    expect(m.startsWith("# Ana Torres")).toBe(true)
    expect(m).toContain("## Experiencia")
    expect(m).toContain(`### ${cv.experience[0].role} (Mar 2022 – Actual)`)
    for (const s of strings(cv)) expect(m).toContain(s)
  })
  it("inglés: usa los títulos en inglés", () => {
    expect(toText(cv, "en")).toContain("EXPERIENCE")
    expect(toMarkdown(cv, "en")).toContain("## Skills")
  })
  it("Word: es un .docx válido y, al leerlo como lo haría un ATS, conserva todo el texto en el orden elegido", async () => {
    const buf = await toDocx(cv)
    expect(buf.subarray(0, 2).toString()).toBe("PK") // zip
    const { value: text } = await mammoth.extractRawText({ buffer: buf })
    for (const s of strings(cv)) expect(text).toContain(s)
    expect(text.indexOf("HABILIDADES")).toBeLessThan(text.indexOf("RESUMEN"))
    expect(text.indexOf(cv.experience[0].bullets[0])).toBeLessThan(text.indexOf(cv.experience[0].bullets[1]))
    const html = (await mammoth.convertToHtml({ buffer: buf })).value
    expect(html).not.toContain("<table")
    expect(html).toContain("<li>")
  })
  it("ningún formato añade texto que el CV no tenga (salvo los títulos de sección)", () => {
    const allowed = new Set(["resumen", "experiencia", "educacion", "educación", "habilidades", "idiomas", "proyectos"])
    const corpus = JSON.stringify(cv).toLowerCase()
    for (const out of [toText(cv), toMarkdown(cv)]) {
      const words = out.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []
      const extra = words.filter((w) => !corpus.includes(w) && !allowed.has(w))
      expect(extra).toEqual([])
    }
  })
  it("nombre de archivo con la extensión del formato", () => {
    expect(cvFileName("Ana Torres", "Initech", "docx")).toBe("CV-Ana-Torres-Initech.docx")
    expect(cvFileName("Ana Torres", undefined, "md")).toBe("CV-Ana-Torres.md")
  })
  it("la ruta /api/export entrega Word, TXT y Markdown con su tipo y nombre", async () => {
    const call = (format: string) => POST(new Request("http://x/api/export", { method: "POST", body: JSON.stringify({ cv, company: "Initech", format }) }))
    const docx = await call("docx")
    expect(docx.headers.get("Content-Type")).toContain("wordprocessingml")
    expect(docx.headers.get("Content-Disposition")).toContain("CV-Ana-Torres-Initech.docx")
    expect(new Uint8Array(await docx.arrayBuffer())[0]).toBe(0x50)
    const txt = await call("txt")
    expect(txt.headers.get("Content-Type")).toContain("text/plain")
    expect(await txt.text()).toContain("HABILIDADES")
    expect((await call("md")).headers.get("Content-Disposition")).toContain(".md")
    expect((await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ cv: { nope: 1 } }) }))).status).toBe(400)
  })
})
