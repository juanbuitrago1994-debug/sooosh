import { readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DiagnosisCard, styleSentence } from "@/components/cv/diagnosis-card"
import { splitBlocks } from "@/lib/cv/blocks"
import { extractContact } from "@/lib/cv/contact"
import { parseDate, RANGE_RE, totalYears } from "@/lib/cv/dates"
import { detectLanguage, pickQuestion } from "@/lib/cv/diagnosis"
import { parseEduHead, parseJobHead, splitEducation } from "@/lib/cv/heads"
import { parseLanguages, parseSkills } from "@/lib/cv/lists"
import { headingKind, splitSections } from "@/lib/cv/sections"
import { readNdjson } from "@/lib/ai/ollama"
import { cvSchema } from "@/lib/schemas/cv"
import { diagnosisSchema } from "@/lib/schemas/diagnosis"

const fx = (n: string) => readFileSync(path.join(__dirname, "fixtures", n), "utf8")

describe("sectorización por encabezados", () => {
  it("reconoce encabezados en español e inglés, con tildes, mayúsculas y dos puntos", () => {
    for (const [l, k] of [["EXPERIENCIA", "experience"], ["Experiencia laboral:", "experience"], ["Educación", "education"], ["WORK EXPERIENCE", "experience"], ["Skills", "skills"], ["Idiomas", "languages"], ["Perfil profesional", "summary"], ["Proyectos", "projects"], ["Certificaciones", "other"]] as const) {
      expect(headingKind(l)?.kind, l).toBe(k)
    }
  })
  it("tolera errores de OCR en los encabezados (EXPERTENCIA, EDUCACION con errata) sin confundir palabras comunes", () => {
    expect(headingKind("EXPERTENCIA")?.kind).toBe("experience")
    expect(headingKind("Experienca laboral")).toBeNull() // dos palabras: solo coincidencia exacta
    expect(headingKind("PROYECTOS")?.kind).toBe("projects")
    for (const l of ["Habilidad", "Perfeccionista", "Interesante", "Documentos"]) expect(headingKind(l), l).toBeNull()
  })
  it("no confunde frases ni líneas con datos con encabezados", () => {
    for (const l of ["Experiencia en ventas durante 3 años liderando equipos", "Analista de Datos", "ana@x.com", "Universidad 2015"]) expect(headingKind(l), l).toBeNull()
  })
  it("divide el CV típico en sus 6 secciones, en orden", () => {
    const { header, sections } = splitSections(fx("cv-tipico.txt"))
    expect(header).toMatch(/^Laura Mendoza Ríos/)
    expect(sections.map((s) => s.kind)).toEqual(["summary", "experience", "education", "skills", "languages", "projects"])
  })
  it("sin encabezados no hay secciones", () => {
    expect(splitSections(fx("cv-sin-secciones.txt")).sections).toEqual([])
  })
})

describe("contacto", () => {
  it("correo, teléfono (no confunde años) y enlaces con su etiqueta", () => {
    const c = extractContact("Ana | ana.torres@example.com | +57 300 123 4567 | linkedin.com/in/ana-torres | github.com/ana | 2019 - 2021")
    expect(c.email).toBe("ana.torres@example.com")
    expect(c.phone).toBe("+57 300 123 4567")
    expect(c.links).toEqual([{ label: "LinkedIn", url: "linkedin.com/in/ana-torres" }, { label: "GitHub", url: "github.com/ana" }])
  })
  it("el correo no genera un falso sitio web y un rango de años no es un teléfono", () => {
    const c = extractContact("laura.mendoza@example.com\n2019 - 2021")
    expect(c.links).toEqual([])
    expect(c.phone).toBeUndefined()
  })
})

describe("fechas", () => {
  it("rangos con meses, años, 'Actual' y 'Present'", () => {
    for (const s of ["Mar 2021 - Actual", "2020 – Present", "Ene 2018 - Feb 2021", "03/2019 al 08/2021", "enero de 2020 hasta presente"]) expect(RANGE_RE.test(s), s).toBe(true)
  })
  it("años de experiencia sin contar dos veces los periodos solapados", () => {
    const now = new Date("2026-11-16")
    expect(totalYears([{ start: "Ene 2020", end: "Dic 2020" }, { start: "Jul 2020", end: "Dic 2021" }], now)).toBe(2)
    expect(totalYears([{ start: "Mar 2021", end: "Actual" }], now)).toBeCloseTo(5.7, 0)
    expect(totalYears([], now)).toBeNull()
    expect(parseDate("Sept 2019")).toEqual({ y: 2019, m: 9 })
  })
})

describe("bloques, cabeceras, habilidades e idiomas", () => {
  it("bloques de experiencia con viñetas partidas en dos líneas", () => {
    const b = splitBlocks("Analista — Initech\nMar 2021 - Actual\n- Reduje el tiempo de los reportes\n  semanales en 30%\n- Diseñé tableros\n\nPracticante — Hooli\nJun 2017 - Dic 2017\n- Apoyé en limpieza de datos")
    expect(b).toHaveLength(2)
    expect(b[0].bullets).toEqual(["Reduje el tiempo de los reportes semanales en 30%", "Diseñé tableros"])
    expect(b[1].head).toEqual(["Practicante — Hooli", "Jun 2017 - Dic 2017"])
  })
  it("cabeceras de puesto en 5 formatos distintos", () => {
    const j = (...h: string[]) => parseJobHead(h)
    expect(j("Analista de Datos Senior — Initech S.A.", "Lima, Perú | Mar 2021 - Actual")).toMatchObject({ role: "Analista de Datos Senior", company: "Initech S.A.", location: "Lima, Perú", confident: true })
    expect(j("Initech S.A. - Analista de Datos (Mar 2021 - Actual)")).toMatchObject({ role: "Analista de Datos", company: "Initech S.A." }) // empresa primero
    expect(j("Desarrolladora Backend", "Acme S.A. | Mar 2021 - Actual")).toMatchObject({ role: "Desarrolladora Backend", company: "Acme S.A." }) // dos líneas
    expect(j("Software Engineer at Globex (2020 - Present)")).toMatchObject({ role: "Software Engineer", company: "Globex" })
    expect(j("Gerente Comercial | Soylent | 2015 - 2019")).toMatchObject({ role: "Gerente Comercial", company: "Soylent" })
  })
  it("una cabecera sin empresa clara se marca como no confiable (irá al modelo)", () => {
    expect(parseJobHead(["Proyecto Aurora", "Mar 2020 - Actual"]).confident).toBe(false)
  })
  it("estudios: institución y título en cualquier orden; 'en' no parte el título", () => {
    expect(parseEduHead(["Universidad Nacional de Ingeniería — Ingeniería Estadística (2012 - 2017)"])).toMatchObject({ institution: "Universidad Nacional de Ingeniería", degree: "Ingeniería Estadística", startDate: "2012", endDate: "2017" })
    expect(parseEduHead(["Diplomado en Ciencia de Datos, Pontificia Universidad Católica del Perú (2019)"])).toMatchObject({ institution: "Pontificia Universidad Católica del Perú", degree: "Diplomado en Ciencia de Datos", endDate: "2019" })
    expect(splitEducation("Universidad A — Ingeniería (2012 - 2017)\nDiplomado, Instituto B (2019)\n- Beca de excelencia")).toHaveLength(2)
  })
  it("habilidades con y sin categoría, idiomas con nivel", () => {
    expect(parseSkills("Lenguajes: SQL, Python\nGit • Docker | Linux")).toEqual([{ items: ["Git", "Docker", "Linux"] }, { category: "Lenguajes", items: ["SQL", "Python"] }])
    expect(parseLanguages("Español (nativo), Inglés: B2\nFrancés - básico\nPortugués")).toEqual([
      { name: "Español", level: "nativo" }, { name: "Inglés", level: "B2" }, { name: "Francés", level: "básico" }, { name: "Portugués" },
    ])
  })
})

describe("idioma y pregunta única", () => {
  it("detecta español e inglés", () => {
    expect(detectLanguage(fx("cv-tipico.txt")).lang).toBe("es")
    expect(detectLanguage(fx("cv-english.txt")).lang).toBe("en")
  })
  it("como máximo UNA pregunta, por prioridad, y solo con confianza baja", () => {
    const alta = { name: "alta", contact: "alta", experience: "alta", education: "alta", language: "alta" } as const
    expect(pickQuestion(alta, "x".repeat(900))).toBeNull()
    expect(pickQuestion({ ...alta, name: "baja", experience: "baja", language: "baja" }, "x".repeat(900))?.id).toBe("fullName")
    expect(pickQuestion({ ...alta, experience: "baja", language: "baja" }, "x".repeat(900))?.id).toBe("experience")
    expect(pickQuestion({ ...alta, language: "baja" }, "x".repeat(900))?.id).toBe("language")
    expect(pickQuestion({ ...alta, experience: "baja" }, "corto")).toBeNull()
  })
})

describe("DiagnosisCard (solo lectura)", () => {
  const cv = cvSchema.parse({ header: { fullName: "Laura Mendoza", headline: "Analista de Datos" }, experience: [{ company: "Initech", role: "Analista", startDate: "2021", bullets: ["Reduje costos en 30%."] }] })
  const base = diagnosisSchema.parse({
    language: "es",
    sections: [{ kind: "experience", title: "Experiencia", order: 0 }],
    style: { tone: "formal", person: "primera", tenses: "pasado", bullets: "viñetas", metrics: { bulletsTotal: 4, bulletsWithMetrics: 3, ratio: 0.75 }, avgBulletWords: 12 },
    seniority: { label: "semi-senior", years: 3.5, basis: "3,5 años" },
    strengths: [1, 2, 3].map((n) => ({ text: `Fortaleza ${n}`, evidence: `Fortaleza ${n}` })),
    problems: [1, 2, 3, 4].map((n) => ({ kind: "generico" as const, text: `Problema ${n}` })),
    atsRisks: ["Sin teléfono."],
    confidence: { name: "alta", contact: "alta", experience: "alta", education: "alta", language: "alta" },
    question: null,
  })
  const render = (d = base) => renderToStaticMarkup(<DiagnosisCard cv={cv} diagnosis={d} onAnswer={() => {}} onCorrect={() => {}} />)

  it("muestra lo esencial y deja el resto plegado; solo 2 fortalezas y 3 mejoras a la vista", () => {
    const html = render()
    expect(html).toContain("Laura Mendoza")
    expect(html).toContain("Semi-senior · 3,5 años")
    expect(html).toContain("1 puesto")
    expect(html).toContain("Primera persona, verbos en pasado, con viñetas; 3 de 4 viñetas con cifras.")
    expect(html).toContain("Fortaleza 1")
    expect(html).toContain("Problema 3")
    expect(html).toContain("Ver el diagnóstico completo")
    expect(html).toContain("Corregir")
  })
  it("sin pregunta no muestra ninguna; con pregunta muestra solo esa", () => {
    expect(render()).not.toContain("pregunta-cv")
    const html = render({ ...base, question: { id: "fullName", kind: "text", text: "¿Cómo te llamas?" } })
    expect(html).toContain("¿Cómo te llamas?")
    expect(html.match(/id="pregunta-cv"/g)).toHaveLength(1)
  })
  it("frase de estilo", () => {
    expect(styleSentence({ ...base, style: { ...base.style, person: "impersonal", tenses: "infinitivo", bullets: "párrafos", metrics: { bulletsTotal: 0, bulletsWithMetrics: 0, ratio: 0 } } })).toBe("Estilo impersonal, verbos en infinitivo, en párrafos; sin viñetas de logros.")
  })
})

describe("lector del stream de Ollama", () => {
  const streamOf = (chunks: string[]) =>
    new Response(new ReadableStream({ start(c) { chunks.forEach((x) => c.enqueue(new TextEncoder().encode(x))); c.close() } }))
  it("une los fragmentos aunque una línea llegue partida y mide el primer token", async () => {
    const r = await readNdjson(streamOf(['{"message":{"content":"{\\"a\\""},"done":false}\n{"mess', 'age":{"content":": 1}"},"done":false}\n{"done":true}\n']))
    expect(r.content).toBe('{"a": 1}')
    expect(r.firstTokenMs).toBeGreaterThanOrEqual(0)
  })
  it("un error dentro del stream se informa", async () => {
    await expect(readNdjson(streamOf(['{"error":"modelo no cargado"}\n']))).rejects.toThrow(/modelo no cargado/)
  })
})
