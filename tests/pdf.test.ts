import { describe, expect, it } from "vitest"
import { extractText, getDocumentProxy } from "unpdf"
import { POST } from "@/app/api/export/route"
import { pdfFileName } from "@/lib/pdf/filename"
import { renderCvPdf } from "@/lib/pdf/render"
import { HEADINGS, renderCvHtml } from "@/lib/pdf/template"
import { cvSchema, type CV } from "@/lib/schemas/cv"
import { cvCorpus } from "@/lib/rewrite/verify"

// CV de ejemplo (ficticio) con tildes, ñ, símbolos HTML y todas las secciones.
const cv: CV = cvSchema.parse({
  header: {
    fullName: "Ana Zapata Núñez",
    headline: "Analista de datos",
    email: "ana@ejemplo.com",
    phone: "+00 000 000 000",
    location: "Lima, Perú",
    links: [{ label: "GitHub", url: "github.com/ana-ejemplo" }],
  },
  summary: "Analista con 4 años de experiencia en reportes de ventas & consultas SQL.",
  experience: [
    {
      company: "Initech",
      role: "Analista de Datos Senior",
      location: "Lima",
      startDate: "Marzo 2021",
      endDate: "Actual",
      bullets: ["Reduje en 30% el tiempo de los reportes semanales con Excel y SQL.", "Armé tableros de ventas en Power BI para el equipo <comercial>."],
    },
    { company: "Globex", role: "Analista Junior", startDate: "2018", endDate: "2021", bullets: ["Coordiné a 3 personas en la migración de informes."] },
  ],
  education: [{ institution: "Universidad Nacional", degree: "Licenciatura", field: "Estadística", startDate: "2013", endDate: "2017", details: [] }],
  skills: [{ category: "Herramientas", items: ["Excel", "SQL", "Power BI"] }],
  languages: [{ name: "Español", level: "Nativo" }, { name: "Inglés", level: "B2" }],
  projects: [{ name: "Panel de Ventas", description: "Panel interno de ventas.", technologies: ["Python"], bullets: ["Automaticé la carga de datos con Python."] }],
})

const words = (s: string) => (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 0)

async function readPdf(buf: Buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(buf))
  const { totalPages, text } = await extractText(pdf, { mergePages: true })
  return { totalPages, text }
}

describe("pdfFileName", () => {
  it("CV-<nombre>-<empresa>.pdf sin tildes, espacios ni símbolos", () => {
    expect(pdfFileName("Ana Zapata Núñez", "Initech S.A.")).toBe("CV-Ana-Zapata-Nunez-Initech-S-A.pdf")
    expect(pdfFileName("José  Pérez", "Globex")).toBe("CV-Jose-Perez-Globex.pdf")
  })
  it("sin empresa omite el segmento", () => {
    expect(pdfFileName("Ana Zapata")).toBe("CV-Ana-Zapata.pdf")
    expect(pdfFileName("Ana Zapata", "")).toBe("CV-Ana-Zapata.pdf")
  })
  it("no deja caracteres peligrosos para un nombre de archivo", () => {
    expect(pdfFileName("../../etc/passwd", 'Ac"me')).toBe("CV-etc-passwd-Ac-me.pdf")
  })
})

describe("renderCvHtml", () => {
  it("escapa el HTML del contenido", () => {
    const html = renderCvHtml(cv)
    expect(html).toContain("&lt;comercial&gt;")
    expect(html).toContain("&amp; consultas")
    expect(html).not.toContain("<comercial>")
  })
  it("es de una sola columna, sin tablas ni imágenes (apto para ATS)", () => {
    const html = renderCvHtml(cv)
    expect(html).not.toMatch(/<(table|img|svg|canvas|iframe)\b/i)
    expect(html).toMatch(/size: A4/)
  })
  it("omite las secciones vacías y no añade texto propio", () => {
    const html = renderCvHtml(cvSchema.parse({ header: { fullName: "Ana Zapata" } }))
    expect(html).toContain("Ana Zapata")
    for (const h of Object.values(HEADINGS.es)) expect(html).not.toContain(`>${h}<`)
  })
  it("usa los títulos de sección en el idioma pedido", () => {
    expect(renderCvHtml(cv, "es")).toContain(">Experiencia<")
    expect(renderCvHtml(cv, "en")).toContain(">Experience<")
  })
})

describe("renderCvPdf (Chromium real)", () => {
  it("genera un PDF de 1–2 páginas con texto seleccionable: nombre y primer cargo", async () => {
    const buf = await renderCvPdf(cv)
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-")
    const { totalPages, text } = await readPdf(buf)
    expect(totalPages).toBeGreaterThanOrEqual(1)
    expect(totalPages).toBeLessThanOrEqual(2)
    expect(text).toContain("Ana Zapata Núñez")
    expect(text).toContain(cv.experience[0].role)
    expect(text).toContain("Reduje en 30% el tiempo de los reportes semanales con Excel y SQL.")
    expect(text).toContain("<comercial>") // el escape no se ve en el PDF
  }, 60_000)

  it("no contiene ningún texto que no esté en el CV original (salvo los títulos de sección)", async () => {
    const { text } = await readPdf(await renderCvPdf(cv))
    const allowed = new Set([...words(cvCorpus(cv)), ...Object.values(HEADINGS.es).flatMap(words)])
    const foreign = [...new Set(words(text))].filter((w) => !allowed.has(w))
    expect(foreign).toEqual([])
  }, 60_000)

  it("un CV largo pasa a más páginas en vez de cortarse", async () => {
    const long = cvSchema.parse({
      ...cv,
      experience: Array.from({ length: 12 }, (_, i) => ({ company: `Empresa ${i}`, role: `Cargo ${i}`, startDate: "2020", bullets: Array.from({ length: 5 }, (_, j) => `Logro número ${j} del puesto ${i} con detalle suficiente para ocupar la línea.`) })),
    })
    const { totalPages, text } = await readPdf(await renderCvPdf(long))
    expect(totalPages).toBeGreaterThan(2)
    expect(text).toContain("Cargo 11")
  }, 60_000)
})

describe("POST /api/export", () => {
  const req = (body: unknown) => new Request("http://x/api/export", { method: "POST", body: JSON.stringify(body) })

  it("devuelve el PDF con nombre de archivo y número de páginas", async () => {
    const res = await POST(req({ cv, company: "Globex" }))
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="CV-Ana-Zapata-Nunez-Globex.pdf"')
    expect(Number(res.headers.get("x-pdf-pages"))).toBeGreaterThanOrEqual(1)
    expect(Buffer.from(await res.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-")
  }, 60_000)

  it("rechaza un CV inválido con mensaje en español", async () => {
    const res = await POST(req({ cv: { header: {} } }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/CV no es válido/)
  })
})
