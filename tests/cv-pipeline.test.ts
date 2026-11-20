import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

type Call = { system: string; user: string; options?: { numCtx?: number; numPredict?: number } }
const calls: Call[] = []
let respond: ((c: Call) => unknown) | null = null
let failWith: Error | null = null
vi.mock("@/lib/ai", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai")>()),
  getProvider: () => ({
    name: "mock",
    generateStructured: (r: Call) => {
      calls.push({ system: r.system, user: r.user, options: r.options })
      if (failWith) return Promise.reject(failWith)
      return Promise.resolve({ data: respond!(r), meta: {} })
    },
  }),
}))

import { AIError } from "@/lib/ai"
import { runCvPipeline, STAGES } from "@/lib/cv/pipeline"
import { guardCorpus, freezeSource } from "@/lib/cv/source"
import { cvSchema } from "@/lib/schemas/cv"

const fx = (n: string) => readFileSync(path.join(__dirname, "fixtures", n), "utf8")
const now = new Date("2026-11-16")
/** El modelo "elige" las dos primeras viñetas como fortalezas. */
const picks = () => ({ picks: [0, 1] })

beforeEach(() => {
  calls.length = 0
  respond = picks
  failWith = null
})

describe("pipeline · CV típico en español", () => {
  it("resuelve casi todo sin IA: una sola llamada pequeña al modelo (fortalezas por número de viñeta)", async () => {
    const r = await runCvPipeline(fx("cv-tipico.txt"), { now })
    expect(r.method).toBe("estructurado")
    expect(calls).toHaveLength(1)
    expect(calls[0].system).toMatch(/Devuelve únicamente \{"picks"/)
    expect(calls[0].options?.numCtx).toBeUndefined() // un único contexto: cambiarlo recarga el modelo en Ollama
    expect(calls[0].options?.numPredict).toBeLessThanOrEqual(100) // salida diminuta (cada token cuesta ~0,12 s)
    expect(r.llmCalls).toBe(1)
  })

  it("extrae identidad, contacto, puestos con empresa y fechas, formación, habilidades, idiomas y proyectos", async () => {
    const { cv } = await runCvPipeline(fx("cv-tipico.txt"), { now })
    expect(cv.header).toMatchObject({ fullName: "Laura Mendoza Ríos", headline: "Analista de Datos", email: "laura.mendoza@example.com", phone: "+51 987 654 321", location: "Lima, Perú" })
    expect(cv.header.links).toEqual([{ label: "LinkedIn", url: "linkedin.com/in/laura-mendoza-ejemplo" }]) // sin falsos positivos tipo «laura.me»
    expect(cv.summary).toMatch(/^Analista de datos con 6 años/)
    expect(cv.experience.map((e) => [e.role, e.company, e.startDate, e.endDate, e.bullets.length])).toEqual([
      ["Analista de Datos Senior", "Initech S.A.", "Mar 2021", "Actual", 4],
      ["Analista de Datos", "Globex Perú", "Ene 2018", "Feb 2021", 3],
      ["Practicante de Inteligencia Comercial", "Hooli", "Jun 2017", "Dic 2017", 2],
    ])
    expect(cv.experience[0].location).toBe("Lima, Perú")
    expect(cv.education.map((e) => [e.institution, e.degree, e.endDate])).toEqual([
      ["Universidad Nacional de Ingeniería", "Ingeniería Estadística", "2017"],
      ["Pontificia Universidad Católica del Perú", "Diplomado en Ciencia de Datos", "2019"],
    ])
    expect(cv.skills[0]).toEqual({ category: "Lenguajes", items: ["SQL", "Python", "R"] })
    expect(cv.languages).toEqual([{ name: "Español", level: "nativo" }, { name: "Inglés", level: "B2" }])
    expect(cv.projects[0]).toMatchObject({ name: "Panel de seguimiento de ventas", technologies: ["Python", "Power BI", "SQL"] })
    expect(cvSchema.safeParse(cv).success).toBe(true)
  })

  it("el diagnóstico describe idioma, secciones en orden, estilo, seniority y problemas", async () => {
    const { diagnosis: d } = await runCvPipeline(fx("cv-tipico.txt"), { now })
    expect(d.language).toBe("es")
    expect(d.sections.map((s) => s.kind)).toEqual(["summary", "experience", "education", "skills", "languages", "projects"])
    expect(d.style).toMatchObject({ person: "primera", tenses: "pasado", tone: "formal", bullets: "viñetas" })
    expect(d.style.metrics).toMatchObject({ bulletsTotal: 10, bulletsWithMetrics: 6 })
    expect(d.seniority).toMatchObject({ label: "senior" })
    expect(d.seniority.years).toBeGreaterThan(9)
    expect(d.problems.some((p) => p.kind === "generico" && /responsable de/i.test(p.text))).toBe(true)
    expect(d.confidence).toEqual({ name: "alta", contact: "alta", experience: "alta", education: "alta", language: "alta" })
    expect(d.question).toBeNull() // confianza alta: no se pregunta nada
  })

  it("las fortalezas son viñetas del CV, tal cual (no se pueden inventar)", async () => {
    const { cv, diagnosis } = await runCvPipeline(fx("cv-tipico.txt"), { now })
    const all = new Set(cv.experience.flatMap((e) => e.bullets))
    expect(diagnosis.strengths.length).toBeGreaterThan(0)
    for (const s of diagnosis.strengths) expect(all.has(s.text)).toBe(true)
  })

  it("si el modelo responde algo inválido, las fortalezas salen de las viñetas con cifras", async () => {
    respond = () => ({ picks: [999] })
    const { diagnosis } = await runCvPipeline(fx("cv-tipico.txt"), { now })
    expect(diagnosis.strengths.length).toBeGreaterThan(0)
    expect(diagnosis.strengths.every((s) => /\d|%/.test(s.text))).toBe(true)
  })

  it("mide el tiempo de cada etapa y avisa el avance real", async () => {
    const seen: number[] = []
    const r = await runCvPipeline(fx("cv-tipico.txt"), { now, onStage: (i) => seen.push(i) })
    expect(seen).toEqual([1, 2, 3, 4, 5])
    expect(STAGES).toHaveLength(6)
    expect(Object.keys(r.timings)).toEqual(expect.arrayContaining(["secciones", "fortalezas", "diagnostico"]))
    for (const ms of Object.values(r.timings)) expect(ms).toBeGreaterThanOrEqual(0)
  })
})

describe("pipeline · otros formatos", () => {
  it("CV en inglés: 'Empresa — Cargo' y 'Empresa | Cargo', viñetas •, idioma y fechas", async () => {
    const { cv, diagnosis } = await runCvPipeline(fx("cv-english.txt"), { now })
    expect(cv.header.fullName).toBe("Daniel Ortega")
    expect(cv.experience.map((e) => [e.role, e.company, e.startDate, e.endDate])).toEqual([
      ["Senior Software Engineer", "Globex Corp", "2020", "Present"],
      ["Software Engineer", "Initech", "Jan 2016", "Dec 2019"],
    ])
    expect(cv.education[0]).toMatchObject({ institution: "University of Texas at Austin", degree: "B.Sc. Computer Science" })
    expect(cv.languages).toEqual([{ name: "English", level: "native" }, { name: "Spanish", level: "C1" }])
    expect(diagnosis.language).toBe("en")
    expect(diagnosis.style.person).toBe("primera") // "Led", "Built", "Developed"
  })

  it("una cabecera ambigua se resuelve con UNA llamada diminuta, verificada contra el texto", async () => {
    const text = "Ana Soto\nIngeniera\nana@example.com 987654321\n\nEXPERIENCIA\nProyecto Aurora\nMar 2020 - Actual\n- Lideré la migración de datos a la nube con 3 equipos.\n- Reduje costos de infraestructura en 20% en seis meses.\n"
    respond = (c) => (c.system.includes("cabecera de un puesto") ? { role: "Ingeniera de Datos", company: "Aurora Labs", location: undefined } : { picks: [0] })
    const { cv } = await runCvPipeline(text, { now })
    expect(calls.some((c) => c.system.includes("cabecera de un puesto"))).toBe(true)
    // «Ingeniera de Datos» y «Aurora Labs» no están en la cabecera → se descartan y se usa lo que sí dice el texto
    expect(cv.experience[0].role).not.toBe("Ingeniera de Datos")
    expect(cv.experience[0].company).not.toBe("Aurora Labs")
  })

  it("sin nombre reconocible: pregunta el nombre (una sola pregunta) y no lo inventa", async () => {
    const text = "contacto: ana@example.com\n\nEXPERIENCIA\nAnalista — Initech\nMar 2020 - Actual\n- Reduje el tiempo de los reportes en 30% con SQL.\n- Diseñé tableros de ventas para el área comercial.\n"
    respond = (c) => (c.system.includes("encabezado") ? {} : { picks: [0] })
    const { cv, diagnosis } = await runCvPipeline(text, { now })
    expect(cv.header.fullName).toBe("Sin nombre")
    expect(diagnosis.confidence.name).toBe("baja")
    expect(diagnosis.question).toMatchObject({ id: "fullName", kind: "text" })
  })

  it("sin encabezados de sección usa el método clásico (una llamada) y aun así diagnostica", async () => {
    respond = (c) =>
      c.system.includes("extractor de datos de currículums")
        ? cvSchema.parse({ header: { fullName: "Marcos Villanueva" }, experience: [{ company: "Distribuidora", role: "Contador", startDate: "2018", bullets: ["Gestioné facturación"] }] })
        : { picks: [0] }
    const r = await runCvPipeline(fx("cv-sin-secciones.txt"), { now })
    expect(r.method).toBe("clasico")
    expect(r.cv.header.fullName).toBe("Marcos Villanueva")
    expect(r.diagnosis.language).toBe("es")
  })

  it("sin encabezados y con fechas: el modelo solo señala números de línea y el resto sigue siendo determinista", async () => {
    const text = fx("cv-word-plano.txt")
    const lines = text.split("\n")
    const at = (needle: string) => lines.findIndex((l) => l.includes(needle))
    respond = (c) =>
      c.system.includes("Indica en qué número de línea EMPIEZA")
        ? { sections: [{ kind: "summary", line: at("Soy contadora") }, { kind: "experience", line: at("Auditora Senior") }, { kind: "education", line: at("Contadora Pública,") }, { kind: "skills", line: at("Excel avanzado") }] }
        : { picks: [0] }
    const r = await runCvPipeline(text, { now })
    expect(r.method).toBe("estructurado")
    expect(r.cv.header.fullName).toBe("Camila Ortega Duarte")
    expect(r.cv.experience.map((e) => [e.role, e.company, e.startDate])).toEqual([
      ["Auditora Senior", "Baker Ruiz y Asociados", "Enero 2020"],
      ["Analista Contable", "Comercial Andina", "Marzo 2016"],
    ])
    expect(r.diagnosis.seniority.years).toBeGreaterThan(9)
    // el contenido de cada sección es texto original, no generado
    for (const e of r.cv.experience) for (const b of e.bullets) expect(text).toContain(b)
  })

  it("si el modelo devuelve una segmentación inválida, cae al método clásico", async () => {
    respond = (c) => (c.system.includes("extractor de datos de currículums") ? cvSchema.parse({ header: { fullName: "Camila" }, experience: [] }) : { sections: [{ kind: "experience", line: 9999 }] })
    const r = await runCvPipeline(fx("cv-word-plano.txt"), { now })
    expect(r.method).toBe("clasico")
  })

  it("si Ollama no está disponible el error se propaga (para mostrar los pasos de ayuda)", async () => {
    failWith = new AIError("unreachable", "No se pudo conectar con Ollama")
    await expect(runCvPipeline(fx("cv-tipico.txt"), { now })).rejects.toMatchObject({ code: "unreachable" })
  })
})

describe("fuente de verdad inmutable", () => {
  it("el texto y el CV originales están congelados", async () => {
    const { cv } = await runCvPipeline(fx("cv-tipico.txt"), { now })
    const src = freezeSource("texto original", cv)
    expect(Object.isFrozen(src)).toBe(true)
    expect(Object.isFrozen(src.cv.experience[0])).toBe(true)
    expect(() => {
      "use strict"
      ;(src.cv.header as { fullName: string }).fullName = "Otro"
    }).toThrow()
    cv.header.fullName = "Cambiado después"
    expect(src.cv.header.fullName).toBe("Laura Mendoza Ríos") // copia profunda, no comparte referencias
  })

  it("el corpus de verificación = original + solo lo que el usuario añadió", async () => {
    const { cv } = await runCvPipeline(fx("cv-tipico.txt"), { now })
    const src = freezeSource(fx("cv-tipico.txt"), cv)
    const edited = structuredClone(cv)
    edited.skills.push({ category: "Nuevo", items: ["Looker"] })
    const corpus = guardCorpus(src, edited)
    expect(corpus).toContain("Initech S.A.") // original
    expect(corpus).toContain("Looker") // corrección del usuario
    expect(guardCorpus(src, cv)).not.toContain("Looker")
    expect(guardCorpus(null, cv)).toContain("Laura Mendoza Ríos")
  })
})
