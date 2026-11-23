import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import mammoth from "mammoth"
import { extractText, getDocumentProxy } from "unpdf"
import type { AIProvider } from "@/lib/ai"
import { AIError } from "@/lib/ai"
import { formatDate, formatRange, parseParts, sortKey } from "@/lib/ats/dates"
import { renderAtsDocx } from "@/lib/ats/docx"
import { atsFileName } from "@/lib/ats/filename"
import { generateAts } from "@/lib/ats/generate"
import { ATS_HEADINGS, ATS_LABELS } from "@/lib/ats/headings"
import { renderAtsHtml } from "@/lib/ats/html"
import { detectLang } from "@/lib/ats/lang"
import { MONTH_NAMES } from "@/lib/ats/dates"
import { buildAtsDoc, cleanBullet } from "@/lib/ats/model"
import { renderAtsPdf } from "@/lib/ats/pdf"
import { summaryFacts } from "@/lib/ats/summary"
import { atsToText } from "@/lib/ats/text"
import { cvCorpus } from "@/lib/rewrite/verify"
import { cvSchema, type CV } from "@/lib/schemas/cv"

// CV ficticio, desordenado a propósito: experiencias sin orden, fechas en formatos mezclados, viñetas con símbolos, habilidades repetidas.
const cv: CV = cvSchema.parse({
  header: {
    fullName: "Ana Zapata Núñez",
    headline: "Analista de datos",
    email: "ana@ejemplo.com",
    phone: "+00 000 000 000",
    location: "Lima, Perú",
    links: [{ label: "GitHub", url: "github.com/ana-ejemplo" }],
  },
  summary: "Analista con experiencia en reportes de ventas y consultas SQL para equipos comerciales.",
  experience: [
    { company: "Globex", role: "Analista Junior", startDate: "2018", endDate: "2021", bullets: ["• Coordiné a 3 personas en la migración de informes."] },
    { company: "Initech", role: "Analista de Datos Senior", location: "Lima", startDate: "03/2021", endDate: "Actual", bullets: ["- Reduje en 30% el tiempo de los reportes semanales con Excel y SQL.", "▪ Armé tableros de ventas en Power BI."] },
  ],
  education: [{ institution: "Universidad Nacional", degree: "Licenciatura", field: "Estadística", startDate: "2013", endDate: "2017", details: [] }],
  skills: [{ category: "Herramientas", items: ["Excel", "SQL", "excel", "Power BI"] }],
  languages: [{ name: "Español", level: "Nativo" }, { name: "Inglés", level: "B2" }],
  projects: [{ name: "Panel de Ventas", url: "ana.dev/panel", description: "Panel interno de ventas.", technologies: ["Python"], bullets: ["Automaticé la carga de datos con Python."] }],
})

const cvEn: CV = cvSchema.parse({
  header: { fullName: "John Smith", headline: "Product Designer", email: "john@example.com", location: "Austin, USA", links: [] },
  experience: [{ company: "Acme", role: "Senior Designer", startDate: "Jan 2022", endDate: "Present", bullets: ["Led the design of the onboarding flow across web and mobile for the team."] }],
  skills: [{ items: ["Figma", "Prototyping"] }],
})

const words = (s: string) => (s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").match(/[\p{L}\p{N}]+/gu) ?? []).filter(Boolean)

describe("fechas ATS", () => {
  it("entiende los formatos habituales", () => {
    expect(parseParts("Mar 2021")).toEqual({ year: 2021, month: 3 })
    expect(parseParts("Marzo de 2021")).toEqual({ year: 2021, month: 3 })
    expect(parseParts("03/2021")).toEqual({ year: 2021, month: 3 })
    expect(parseParts("2021-03")).toEqual({ year: 2021, month: 3 })
    expect(parseParts("06 nov 2026")).toEqual({ year: 2026, month: 11 })
    expect(parseParts("2018")).toEqual({ year: 2018, month: null })
    expect(parseParts("sin fecha")).toBeNull()
  })
  it("«Mes Año» en el idioma del documento; «Actual» pasa a Presente/Present", () => {
    expect(formatDate("03/2021", "es").text).toBe("Marzo 2021")
    expect(formatDate("03/2021", "en").text).toBe("March 2021")
    expect(formatRange("May 2023", "Actual", "es").text).toBe("Mayo 2023 – Presente")
    expect(formatRange("Jan 2022", "present", "en").text).toBe("January 2022 – Present")
  })
  it("no inventa un mes: con solo el año deja el año y lo señala", () => {
    const r = formatRange("2018", "2021", "es")
    expect(r.text).toBe("2018 – 2021")
    expect(r.issues.map((i) => i.issue)).toEqual(["year-only", "year-only"])
    expect(formatDate("verano", "es")).toEqual({ text: "verano", issue: "unparsed" })
  })
  it("sin fin, solo el inicio; sin ninguna, vacío", () => {
    expect(formatRange("Mar 2020", undefined, "es").text).toBe("Marzo 2020")
    expect(formatRange(undefined, undefined, "es").text).toBe("")
  })
  it("claves de orden: lo abierto es lo más reciente", () => {
    expect(sortKey("Actual", "end")).toBe(Number.POSITIVE_INFINITY)
    expect(sortKey("2021", "end")! > sortKey("Jun 2021", "start")!).toBe(true)
    expect(sortKey("???", "start")).toBeNull()
  })
})

describe("idioma del CV", () => {
  it("detecta español e inglés", () => {
    expect(detectLang(cv)).toMatchObject({ lang: "es", detected: "es" })
    expect(detectLang(cvEn)).toMatchObject({ lang: "en", detected: "en" })
  })
  it("con poco texto no opina y usa español", () => {
    const d = detectLang(cvSchema.parse({ header: { fullName: "Ana Zapata" } }))
    expect(d).toMatchObject({ lang: "es", detected: "otro" })
  })
})

describe("buildAtsDoc · estructura", () => {
  const doc = buildAtsDoc(cv)
  const text = atsToText(doc)
  const lines = text.split("\n")

  it("primera línea el nombre, luego el cargo y la línea de contacto con separador «|»", () => {
    expect(lines.slice(0, 3)).toEqual(["Ana Zapata Núñez", "Analista de datos", "Lima, Perú | +00 000 000 000 | ana@ejemplo.com | github.com/ana-ejemplo"])
  })
  it("secciones con encabezados estándar y en el orden de la plantilla", () => {
    const h = ATS_HEADINGS.es
    const idx = [h.summary, h.experience, h.education, h.skills, h.languages, h.projects].map((t) => lines.indexOf(t))
    expect(idx.every((i) => i > 0)).toBe(true)
    expect([...idx].sort((a, b) => a - b)).toEqual(idx)
  })
  it("experiencia en orden cronológico inverso aunque el original venga al revés", () => {
    const heads = doc.sections.find((s) => s.key === "experience")!.blocks.map((b) => (b.kind === "entry" ? b.head : ""))
    expect(heads).toEqual(["Analista de Datos Senior — Initech, Lima | Marzo 2021 – Presente", "Analista Junior — Globex | 2018 – 2021"])
  })
  it("educación: «Título, campo — Institución | fechas»", () => {
    expect(lines).toContain("Licenciatura, Estadística — Universidad Nacional | 2013 – 2017")
  })
  it("viñetas simples «•» sin los símbolos del original", () => {
    expect(lines).toContain("• Reduje en 30% el tiempo de los reportes semanales con Excel y SQL.")
    expect(lines).toContain("• Armé tableros de ventas en Power BI.")
    expect(text).not.toMatch(/[▪➢●■]|^- /m)
    expect(cleanBullet("  ➢  Hola   mundo ")).toBe("Hola mundo")
  })
  it("habilidades separadas por comas, sin duplicados y sin «|»", () => {
    expect(lines).toContain("Herramientas: Excel, SQL, Power BI")
  })
  it("idiomas y proyectos", () => {
    expect(lines).toContain("Español (Nativo), Inglés (B2)")
    expect(lines).toContain("Panel de Ventas | ana.dev/panel")
    expect(lines).toContain(`${ATS_LABELS.es.technologies}: Python`)
  })
  it("avisa de las fechas con solo el año (no inventa el mes)", () => {
    expect(doc.warnings.filter((w) => w.code === "date-year-only").length).toBeGreaterThan(0)
  })
  it("en inglés usa encabezados y fechas en inglés", () => {
    const en = atsToText(buildAtsDoc(cvEn)).split("\n")
    expect(en).toContain("Work Experience")
    expect(en).toContain("Senior Designer — Acme | January 2022 – Present")
    expect(en).not.toContain("Professional Summary") // sin resumen en el original, no se inventa
  })
  it("si una fecha no se entiende, respeta el orden del original y avisa", () => {
    const d = buildAtsDoc(cvSchema.parse({ ...cv, experience: [{ company: "A", role: "X", startDate: "verano", bullets: [] }, { company: "B", role: "Y", startDate: "2020", bullets: [] }] }))
    expect(d.sections.find((s) => s.key === "experience")!.blocks.map((b) => (b.kind === "entry" ? b.head.slice(0, 1) : ""))).toEqual(["X", "Y"])
    expect(d.warnings.some((w) => w.code === "order-kept")).toBe(true)
  })
  it("las secciones vacías no aparecen", () => {
    const d = buildAtsDoc(cvSchema.parse({ header: { fullName: "Ana Zapata" } }))
    expect(d.sections).toEqual([])
    expect(d.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["no-contact", "no-experience", "summary-missing"]))
  })
})

describe("buildAtsDoc · nunca inventa datos del CV", () => {
  it("toda palabra y cifra del documento sale del CV, de un mes o de un texto fijo", () => {
    for (const [c, lang] of [[cv, "es"], [cvEn, "en"]] as const) {
      const text = atsToText(buildAtsDoc(c))
      const allowed = new Set([
        ...words(cvCorpus({ ...c, sectionOrder: undefined })),
        ...Object.values(ATS_HEADINGS[lang]).flatMap(words),
        ...Object.values(ATS_LABELS[lang]).flatMap(words),
        ...MONTH_NAMES[lang].flatMap(words),
      ])
      const extra = [...new Set(words(text))].filter((w) => !allowed.has(w))
      expect(extra).toEqual([])
    }
  })
  it("no omite ningún puesto, estudio, habilidad ni viñeta del original", () => {
    const text = atsToText(buildAtsDoc(cv))
    for (const e of cv.experience) {
      expect(text).toContain(e.role)
      expect(text).toContain(e.company)
      for (const b of e.bullets) expect(text).toContain(cleanBullet(b))
    }
    for (const e of cv.education) expect(text).toContain(e.institution)
    for (const g of cv.skills) for (const i of g.items.filter((x) => x !== "excel")) expect(text).toContain(i)
  })
})

describe("nombre del archivo", () => {
  it("Nombre-Apellido-Cargo sin tildes ni símbolos", () => {
    const d = buildAtsDoc(cv)
    expect(atsFileName(d, "pdf")).toBe("Ana-Zapata-Nunez-Analista-de-datos.pdf")
    expect(atsFileName(d, "docx")).toMatch(/^[A-Za-z0-9]+(-[A-Za-z0-9]+)*\.docx$/)
  })
  it("sin titular usa el cargo más reciente; sin cargo, solo el nombre", () => {
    expect(atsFileName(buildAtsDoc(cvSchema.parse({ ...cv, header: { ...cv.header, headline: undefined } })), "pdf")).toBe("Ana-Zapata-Nunez-Analista-de-Datos-Senior.pdf")
    expect(atsFileName({ name: "Ana Zapata", fileRole: "" }, "pdf")).toBe("Ana-Zapata.pdf")
  })
})

describe("HTML del PDF", () => {
  const html = renderAtsHtml(buildAtsDoc(cv))
  it("una columna, sin tablas, imágenes, listas gráficas ni colores", () => {
    expect(html).not.toMatch(/<(table|img|svg|canvas|iframe|ul|ol|li|header|footer)\b/i)
    expect(html).not.toMatch(/display:\s*(flex|grid)|column|float|(?<!-)border(?:-\w+)?:|background:\s+(?!#fff)|#(?!000\b|fff\b)[0-9a-f]{3,6}/i)
    expect(html).toContain("font-family: Arial")
    expect(html).toContain("font-size: 10.5pt")
    expect(html).toContain("margin: 20mm")
  })
  it("escapa el contenido", () => {
    expect(renderAtsHtml(buildAtsDoc(cvSchema.parse({ header: { fullName: "A <b>&" } })))).toContain("A &lt;b&gt;&amp;")
  })
})

describe("DOCX ATS", () => {
  it("tiene el texto del documento, sin tablas, cuadros, imágenes, encabezado ni pie", async () => {
    const doc = buildAtsDoc(cv)
    const buf = await renderAtsDocx(doc)
    const dir = mkdtempSync(join(tmpdir(), "ats-docx-"))
    try {
      const file = join(dir, "cv.docx")
      writeFileSync(file, buf)
      const list = execFileSync("unzip", ["-Z1", file]).toString().split("\n")
      expect(list.filter((n) => /header|footer/i.test(n))).toEqual([])
      expect(list.filter((n) => /^word\/media\//.test(n))).toEqual([])
      const xml = execFileSync("unzip", ["-p", file, "word/document.xml"]).toString()
      expect(xml).not.toMatch(/<w:(tbl|txbxContent|drawing|pict|cols\b[^>]*w:num="[2-9]")/)
      expect(xml).not.toMatch(/<w:(headerReference|footerReference)/)
      expect(xml).toContain('w:ascii="Arial"')
      expect(xml).toContain('w:w="11906"') // A4
      expect(xml).toMatch(/w:top="1134"[^>]*w:left="1134"|w:left="1134"[^>]*w:top="1134"/)
      const { value } = await mammoth.extractRawText({ buffer: buf })
      for (const line of atsToText(doc).split("\n").filter((l) => l && !l.startsWith("• "))) expect(value).toContain(line)
      for (const b of doc.sections.flatMap((s) => s.blocks.flatMap((x) => (x.kind === "entry" ? x.bullets : [])))) expect(value).toContain(b)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("PDF ATS (Chromium local)", () => {
  it("texto real y seleccionable en el orden del documento, ≤ 2 páginas", async () => {
    const doc = buildAtsDoc(cv)
    const { pdf, pages } = await renderAtsPdf(doc)
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
    expect(pages).toBeLessThanOrEqual(2)
    const { text } = await extractText(await getDocumentProxy(new Uint8Array(pdf)), { mergePages: true })
    const flat = text.replace(/\s+/g, " ")
    let at = 0
    for (const line of atsToText(doc).split("\n").filter(Boolean)) {
      const i = flat.indexOf(line.replace(/\s+/g, " "), at)
      expect(i, `falta o está fuera de orden: ${line}`).toBeGreaterThanOrEqual(at)
      at = i
    }
  }, 60_000)
})

// ---- Resumen con IA (proveedor falso) ----
const fake = (out: unknown | Error): AIProvider => ({
  name: "fake",
  async generateStructured(req) {
    if (out instanceof Error) throw out
    return { data: req.schema.parse(out), meta: { provider: "fake", model: "fake", ms: 1, attempts: 1 } } as never
  },
})
const noSummary = cvSchema.parse({ ...cv, summary: undefined })
const NOW = new Date("2026-11-23")

describe("resumen con IA", () => {
  it("los años de experiencia salen de las fechas de los puestos", () => {
    expect(summaryFacts(noSummary, NOW).yearsOfExperience).toBe(8) // 2018 → 2026
  })
  it("un resumen que solo usa datos del CV (y los años calculados) se acepta", async () => {
    const s = "Analista de datos con 8 años de experiencia en reportes de ventas. Trabaja con Excel, SQL y Power BI."
    const r = await generateAts(noSummary, { provider: fake({ summary: s }), now: NOW })
    expect(r.summary?.summary).toBe(s)
    expect(r.doc.summarySource).toBe("ia")
    expect(atsToText(r.doc)).toContain(s)
  })
  it("rechaza datos inventados (cifra, herramienta o empresa) y la sección se omite", async () => {
    for (const s of ["Analista de datos con 15 años de experiencia en reportes de ventas. Domina Excel y SQL.", "Analista de datos con experiencia en Tableau y Snowflake. Trabaja con equipos comerciales.", "Analista de datos que pasó por Google y Amazon. Domina Excel y SQL con soltura."]) {
      const r = await generateAts(noSummary, { provider: fake({ summary: s }), now: NOW })
      expect(r.summary).toMatchObject({ summary: null, reason: "no-paso-verificacion" })
      expect(r.doc.summarySource).toBe("none")
      expect(atsToText(r.doc)).not.toContain(s)
    }
  })
  it("rechaza primera persona, exclamaciones y longitud fuera de 2–4 frases", async () => {
    for (const s of ["Yo soy analista de datos con experiencia en Excel y SQL. Me gusta el trabajo en equipo siempre.", "Analista de datos con experiencia en Excel y SQL. ¡Gran trabajo en equipo siempre!", "Analista de datos con experiencia en Excel, SQL y Power BI para el equipo."]) {
      expect((await generateAts(noSummary, { provider: fake({ summary: s }), now: NOW })).summary?.reason).toBe("forma")
    }
  })
  it("sin Ollama no hay resumen ni error", async () => {
    const r = await generateAts(noSummary, { provider: fake(new AIError("unreachable", "x")), now: NOW })
    expect(r.summary?.reason).toBe("ia-no-disponible")
    expect(r.doc.sections.some((s) => s.key === "summary")).toBe(false)
  })
  it("si el CV ya trae resumen, no se llama a la IA; con ai:false tampoco", async () => {
    const boom = fake(new Error("no debería llamarse"))
    expect((await generateAts(cv, { provider: boom })).summary).toBeNull()
    expect((await generateAts(noSummary, { provider: boom, ai: false })).summary).toBeNull()
  })
})
