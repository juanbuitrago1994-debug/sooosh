import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { AlignmentType, Document, Header, ImageRun, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx"
import { chromium } from "playwright"
import { renderAtsDocx } from "@/lib/ats/docx"
import { extractFile } from "@/lib/ats/extract"
import { atsFileName } from "@/lib/ats/filename"
import { buildAtsDoc } from "@/lib/ats/model"
import { renderAtsPdf } from "@/lib/ats/pdf"
import { ATS_RULES } from "@/lib/ats/rules"
import { atsToText } from "@/lib/ats/text"
import { CAP_WITH_CRITICAL_FAIL, scoreRules, verifyAtsFile, type AtsReport } from "@/lib/ats/verify"
import { readZip } from "@/lib/ats/zip"
import { cvSchema, type CV } from "@/lib/schemas/cv"

const cv: CV = cvSchema.parse({
  header: { fullName: "Ana Zapata Núñez", headline: "Ssr. Analista de datos", email: "ana@ejemplo.com", phone: "+00 000 000 000", location: "Lima, Perú", links: [{ label: "GitHub", url: "github.com/ana-ejemplo" }] },
  summary: "Analista con experiencia en reportes de ventas y consultas SQL para equipos comerciales. Trabaja con equipos de producto.",
  experience: [
    { company: "Globex", role: "Analista Junior", startDate: "Ene 2018", endDate: "Dic 2020", bullets: ["Coordiné a 3 personas en la migración de informes."] },
    { company: "Initech", role: "Analista de Datos Senior", location: "Lima", startDate: "03/2021", endDate: "Actual", bullets: ["Reduje en 30% el tiempo de los reportes semanales con Excel y SQL.", "Armé tableros de ventas en Power BI."] },
  ],
  education: [{ institution: "Universidad Nacional", degree: "Licenciatura", field: "Estadística", startDate: "2013", endDate: "2017", details: [] }],
  skills: [{ category: "Herramientas", items: ["Excel", "SQL", "Power BI"] }],
  languages: [{ name: "Español", level: "Nativo" }, { name: "Inglés", level: "B2" }],
})

const doc = buildAtsDoc(cv)
const expectedText = atsToText(doc)
const status = (r: AtsReport, id: string) => r.rules.find((x) => x.id === id)?.status
const failed = (r: AtsReport) => r.rules.filter((x) => x.status === "fail").map((x) => x.id)

async function pdfFromHtml(html: string, opts: { header?: string } = {}): Promise<Buffer> {
  const b = await chromium.launch()
  try {
    const p = await b.newPage()
    await p.setContent(html, { waitUntil: "load" })
    return await p.pdf({ format: "A4", margin: { top: "20mm", bottom: "20mm", left: "20mm", right: "20mm" }, displayHeaderFooter: !!opts.header, headerTemplate: opts.header ?? "<span></span>", footerTemplate: "<span></span>" })
  } finally {
    await b.close()
  }
}

describe("lector de .zip", () => {
  it("abre un .docx y encuentra sus partes", async () => {
    const z = readZip(await renderAtsDocx(doc))
    expect([...z.keys()]).toEqual(expect.arrayContaining(["word/document.xml", "word/styles.xml", "word/numbering.xml"]))
    expect(z.get("word/document.xml")!.toString()).toContain("Ana Zapata")
    expect(() => readZip(Buffer.from("no es un zip"))).toThrow()
  })
})

describe("CV ATS generado por nosotros", () => {
  it("PDF: cumple todas las reglas aplicables (100 %)", async () => {
    const { pdf } = await renderAtsPdf(doc)
    const r = await verifyAtsFile({ file: pdf, fileName: atsFileName(doc, "pdf"), cv, expectedText })
    expect(failed(r)).toEqual([])
    expect(r.percent).toBe(100)
    expect(r.label).toBe("listo")
    expect(r.file).toMatchObject({ format: "pdf", pages: 1, fonts: ["arial"], bodySize: 10.5 })
    expect(r.rules).toHaveLength(42)
    expect(r.readRate).toBe(100)
    expect(r.tips.map((t) => t.id)).toEqual([])
    expect(r.disclaimer).toMatch(/no garantiza/)
  }, 60_000)

  it("Word: cumple todas las reglas aplicables (100 %)", async () => {
    const r = await verifyAtsFile({ file: await renderAtsDocx(doc), fileName: atsFileName(doc, "docx"), cv, expectedText })
    expect(failed(r)).toEqual([])
    expect(r.percent).toBe(100)
    expect(r.file).toMatchObject({ format: "docx", pages: null, fonts: ["arial"] })
  })

  it("las reglas que no aplican no suman ni restan (CV sin enlaces ni correo)", async () => {
    const small = cvSchema.parse({ header: { fullName: "Ana Zapata", location: "Lima" }, experience: [{ company: "Acme", role: "Analista", startDate: "Mar 2020", endDate: "Actual", bullets: ["Reduje el tiempo de los reportes."] }] })
    const d = buildAtsDoc(small)
    const r = await verifyAtsFile({ file: await renderAtsDocx(d), fileName: atsFileName(d, "docx"), cv: small, expectedText: atsToText(d) })
    expect(status(r, "ATS-K3")).toBe("na")
    expect(status(r, "ATS-K4")).toBe("na")
    expect(failed(r)).toEqual([])
    expect(r.percent).toBe(100)
  })
})

describe("archivos malos hechos a propósito", () => {
  it("PDF con dos columnas, imagen, fuente pequeña y de otra familia, colores, viñetas raras, títulos creativos y contacto en el encabezado", async () => {
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    const html = `<html><body style="font-family:'Courier New';font-size:8pt;color:#c00">
      <img src="data:image/png;base64,${png}" width="40" height="40">
      <h1>Ana Zapata Núñez</h1>
      <div style="column-count:2;column-gap:30mm">
        <h2>Mi viaje</h2><p>Analista de datos en Initech</p><p>➢ Armé tableros</p><p>Excel 90%</p>
        <h2>Lo que sé hacer</h2><p>03/2021 - Presente</p><p>Marzo 2020 – Enero 2021</p><p>★★★★ SQL</p>
      </div></body></html>`
    const pdf = await pdfFromHtml(html, { header: '<div style="font-size:9px;margin-left:10mm">ana@ejemplo.com | +00 000 000 000</div>' })
    const r = await verifyAtsFile({ file: pdf, fileName: "mi cv final.pdf", cv, expectedText })
    const f = failed(r)
    expect(f).toEqual(expect.arrayContaining(["ATS-F4", "ATS-T1", "ATS-T2", "ATS-T4", "ATS-F7", "ATS-K1", "ATS-S1"]))
    expect(r.percent).toBeLessThanOrEqual(CAP_WITH_CRITICAL_FAIL)
    expect(r.label).toBe("esencial")
    expect(r.rules.find((x) => x.id === "ATS-T1")?.detail).toMatch(/courier/i)
  }, 60_000)

  it("PDF que es solo una imagen (escaneado): sin texto", async () => {
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    const pdf = await pdfFromHtml(`<html><body><img src="data:image/png;base64,${png}" width="500" height="700"></body></html>`)
    const r = await verifyAtsFile({ file: pdf, fileName: atsFileName(doc, "pdf"), cv, expectedText })
    expect(failed(r)).toEqual(expect.arrayContaining(["ATS-F1", "ATS-F4", "ATS-K1"]))
    expect(r.label).toBe("esencial")
  }, 60_000)

  it("Word con tabla, imagen, encabezado, dos columnas, otra fuente, color y letra pequeña", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64")
    const run = (t: string) => new TextRun({ text: t, font: "Comic Sans MS", size: 16, color: "FF0000" })
    const file = new Document({
      sections: [
        {
          properties: { column: { count: 2, space: 400 }, page: { margin: { top: 300, left: 300, right: 300, bottom: 300 } } },
          headers: { default: new Header({ children: [new Paragraph({ children: [run("ana@ejemplo.com")] })] }) },
          children: [
            new Paragraph({ alignment: AlignmentType.LEFT, children: [run("Ana Zapata Núñez"), new ImageRun({ type: "png", data: png, transformation: { width: 20, height: 20 } })] }),
            new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [run("Mi viaje")] })] })] })] }),
          ],
        },
      ],
    })
    const r = await verifyAtsFile({ file: await Packer.toBuffer(file), fileName: "cv.docx", cv, expectedText })
    expect(failed(r)).toEqual(expect.arrayContaining(["ATS-F3", "ATS-F4", "ATS-F5", "ATS-T1", "ATS-T2", "ATS-T3", "ATS-T4"]))
    expect(r.label).toBe("esencial")
    expect(r.percent).toBeLessThanOrEqual(CAP_WITH_CRITICAL_FAIL)
  })

  it("rechaza lo que no es PDF ni Word", async () => {
    await expect(verifyAtsFile({ file: Buffer.from("hola mundo, esto es texto plano"), fileName: "cv.txt", cv })).rejects.toThrow(/ni un Word/)
  })
})

describe("contenido: inventado u omitido", () => {
  it("detecta una cifra y una herramienta que no están en el CV original (ATS-I1)", async () => {
    const forged = cvSchema.parse({ ...cv, experience: cv.experience.map((e, i) => (i ? { ...e, bullets: [...e.bullets, "Migré 40 informes a Tableau con Snowflake."] } : e)) })
    const d = buildAtsDoc(forged)
    const r = await verifyAtsFile({ file: await renderAtsDocx(d), fileName: atsFileName(d, "docx"), cv, expectedText: atsToText(d) })
    expect(status(r, "ATS-I1")).toBe("fail")
    expect(r.rules.find((x) => x.id === "ATS-I1")?.evidence?.join(" ")).toMatch(/40|Tableau|Snowflake/)
    expect(r.label).toBe("esencial")
  })
  it("detecta un puesto y una habilidad omitidos (ATS-I2)", async () => {
    const cut = cvSchema.parse({ ...cv, experience: cv.experience.slice(1), skills: [{ category: "Herramientas", items: ["Excel"] }] })
    const d = buildAtsDoc(cut)
    const r = await verifyAtsFile({ file: await renderAtsDocx(d), fileName: atsFileName(d, "docx"), cv, expectedText: atsToText(d) })
    expect(status(r, "ATS-I2")).toBe("fail")
    expect(r.rules.find((x) => x.id === "ATS-I2")?.evidence?.join(" ")).toMatch(/Globex|sql|power bi/i)
  })
  it("detecta títulos en otro idioma que el CV original (ATS-I5)", async () => {
    const d = buildAtsDoc(cv, { lang: "en" })
    const r = await verifyAtsFile({ file: await renderAtsDocx(d), fileName: atsFileName(d, "docx"), cv, expectedText: atsToText(d) })
    expect(status(r, "ATS-I5")).toBe("fail")
  })
})

describe("reglas de contenido del original que el generador no reescribe", () => {
  it("viñetas largas o sin verbo y frases vagas bajan el puntaje sin ser críticas", async () => {
    const weak = cvSchema.parse({
      ...cv,
      summary: "Profesional apasionado y proactivo con experiencia en datos. Orientado a resultados en equipos comerciales.",
      experience: [{ company: "Initech", role: "Analista", startDate: "03/2021", endDate: "Actual", bullets: ["Responsable de los reportes semanales de ventas para todas las áreas comerciales de la empresa incluyendo los reportes mensuales trimestrales y anuales de cada una de las regiones y de los equipos de soporte y de apoyo administrativo", "Encargado de tableros"] }],
    })
    const d = buildAtsDoc(weak)
    const r = await verifyAtsFile({ file: await renderAtsDocx(d), fileName: atsFileName(d, "docx"), cv: weak, expectedText: atsToText(d) })
    expect(failed(r)).toEqual(expect.arrayContaining(["ATS-E5", "ATS-I4"]))
    expect(failed(r).some((id) => ATS_RULES.find((x) => x.id === id)?.weight === "C")).toBe(false)
    // A6: lo que depende del contenido son consejos y no restan del porcentaje de formato.
    expect(r.tips.map((t) => t.id)).toEqual(expect.arrayContaining(["ATS-E5", "ATS-I4"]))
    expect(r.percent).toBe(100)
  })

  it("consejos de contenido: pocas cifras y viñetas que empiezan igual (ATS-Q1, ATS-Q2)", async () => {
    const dull = cvSchema.parse({ ...cv, experience: [{ company: "Initech", role: "Analista", startDate: "03/2021", endDate: "Actual", bullets: ["Responsable de reportes.", "Responsable de tableros.", "Responsable de consultas.", "Responsable de la carga de datos."] }] })
    const d = buildAtsDoc(dull)
    const r = await verifyAtsFile({ file: await renderAtsDocx(d), fileName: atsFileName(d, "docx"), cv: dull, expectedText: atsToText(d) })
    expect(r.tips.map((t) => t.id)).toEqual(expect.arrayContaining(["ATS-Q1", "ATS-Q2"]))
    expect(r.percent).toBe(100)
  })

  it("un Word ajeno con títulos en negrita y mayúsculas (sin estilo «Título») también se lee: ATS-S1 ya no falla", async () => {
    const run = (t: string, bold = false) => new TextRun({ text: t, bold, font: "Arial", size: 21 })
    const plain = new Document({ sections: [{ children: [
      new Paragraph({ children: [run("Ana Zapata Núñez", true)] }),
      new Paragraph({ children: [run("Lima, Perú | ana@ejemplo.com")] }),
      new Paragraph({ children: [run("EXPERIENCIA LABORAL", true)] }),
      new Paragraph({ children: [run("Analista de Datos Senior — Initech | 03/2021 – Presente", true)] }),
      new Paragraph({ children: [run("Empresa de software de gestión.")] }),
      new Paragraph({ children: [run("Reduje en 30% el tiempo de los reportes.")] }),
      new Paragraph({ children: [run("EDUCACIÓN", true)] }),
      new Paragraph({ children: [run("Licenciatura — Universidad Nacional | 2017")] }),
      new Paragraph({ children: [run("HABILIDADES:", true)] }),
      new Paragraph({ children: [run("Excel, SQL")] }),
    ] }] })
    const r = await verifyAtsFile({ file: await Packer.toBuffer(plain), fileName: "Ana-Zapata.docx", cv })
    expect(r.rules.find((x) => x.id === "ATS-S1")?.status).toBe("pass")
    expect(r.rules.find((x) => x.id === "ATS-S2")?.status).toBe("pass")
  })

  it("una descripción bajo el puesto, sin viñetas, no se cuenta como puesto vacío (ATS-E6) ni rompe ATS-E1", async () => {
    const desc = buildAtsDoc(cv, { extras: { roles: [{ company: "Initech", role: "Analista de Datos Senior", companyNote: "Empresa de software.", bullets: [] }], certifications: [], volunteering: [], skillGroups: [], projects: [] } })
    expect(atsToText(desc)).toContain("Empresa de software.")
    const r = await verifyAtsFile({ file: await renderAtsDocx(desc), fileName: atsFileName(desc, "docx"), cv, expectedText: atsToText(desc), source: "Empresa de software." })
    expect(r.rules.find((x) => x.id === "ATS-E1")?.status).toBe("pass")
    expect(r.rules.find((x) => x.id === "ATS-E6")?.status).toBe("pass")
  })
})

describe("cálculo del porcentaje", () => {
  const w = (weight: "C" | "A" | "M" | "B", s: "pass" | "fail" | "na") => ({ weight, status: s })
  it("puntos cumplidos ÷ aplicables, con pesos 5/3/2/1; «no aplica» no cuenta", () => {
    const s = scoreRules([w("C", "pass"), w("A", "pass"), w("M", "fail"), w("B", "na")])
    expect(s).toMatchObject({ earned: 8, possible: 10, percent: 80, label: "casi", capped: false })
  })
  it("nunca marca 100 % si algo falla", () => {
    const rules = [w("C", "pass"), ...Array.from({ length: 60 }, () => w("A", "pass")), w("B", "fail")]
    expect(scoreRules(rules).percent).toBe(99)
  })
  it("una regla crítica fallida limita el máximo a 69 % y la etiqueta a «No cumple lo esencial»", () => {
    const s = scoreRules([w("C", "fail"), ...Array.from({ length: 20 }, () => w("A", "pass"))])
    expect(s.rawPercent).toBeGreaterThan(69)
    expect(s).toMatchObject({ percent: 69, capped: true, label: "esencial", labelText: "No cumple lo esencial" })
  })
  it("etiquetas por umbral", () => {
    expect(scoreRules([w("A", "pass")]).label).toBe("listo")
    expect(scoreRules([w("A", "pass"), w("A", "pass"), w("A", "pass"), w("M", "fail")]).label).toBe("casi") // 9/11 = 82 %
    expect(scoreRules([w("A", "pass"), w("A", "fail")]).label).toBe("cambios") // 50 %
  })
  it("sin reglas aplicables, 0 %", () => {
    expect(scoreRules([w("A", "na")]).percent).toBe(0)
  })
})

describe("las reglas del código coinciden con docs/CONOCIMIENTO-ATS.md", () => {
  const md = readFileSync(join(__dirname, "..", "docs", "CONOCIMIENTO-ATS.md"), "utf8")
  const rows = md.split("\n").filter((l) => /^\| ATS-[A-Z]\d+ \|/.test(l)).map((l) => {
    const id = l.match(/^\| (ATS-[A-Z]\d+) \|/)![1]
    const ms = [...l.matchAll(/\| \*{0,2}([CAMB])\*{0,2} \| /g)]
    return { id, weight: ms[ms.length - 1]?.[1] }
  })
  it("mismos ids", () => {
    expect(rows.map((r) => r.id).sort()).toEqual(ATS_RULES.map((r) => r.id).sort())
  })
  it("mismos pesos", () => {
    for (const r of rows) expect(ATS_RULES.find((x) => x.id === r.id)?.weight, r.id).toBe(r.weight)
  })
})

describe("lector de archivos", () => {
  it("el PDF generado se lee con fuente, tamaños y márgenes reales", async () => {
    const { pdf } = await renderAtsPdf(doc)
    const ex = await extractFile(pdf)
    expect(ex).toMatchObject({ format: "pdf", pages: 1, fonts: ["arial"], bodySize: 10.5, imageCount: 0, oddAnnotations: 0 })
    expect(ex.margins!.left).toBeCloseTo(2, 1)
    expect(ex.lines[0]).toMatchObject({ text: "Ana Zapata Núñez", size: 16 })
    expect(ex.lines.filter((l) => l.heading).map((l) => l.text)).toEqual(["Resumen profesional", "Experiencia laboral", "Educación", "Habilidades", "Idiomas"])
  }, 60_000)
})
