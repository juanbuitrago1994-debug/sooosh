import { describe, expect, it } from "vitest"
import { AIError, type AIProvider } from "@/lib/ai"
import { POST } from "@/app/api/ats/route"
import { cleanSkillItem, comparable, extractExtras, groundExtras, type AtsExtras } from "@/lib/ats/enrich"
import { generateAts } from "@/lib/ats/generate"
import { buildAtsDoc, experienceLooksBroken, skillsLookBroken, trimSummary, withExtras } from "@/lib/ats/model"
import { atsToText } from "@/lib/ats/text"
import { generateAtsClient, verifyAtsClient } from "@/lib/ats/client"
import { cvSchema, type CV } from "@/lib/schemas/cv"
import { afterEach, beforeEach, vi } from "vitest"

// Texto original ficticio, como lo dejaría el OCR de un PDF de diseño: símbolos de viñeta raros y líneas partidas.
const SOURCE = `Ana Zapata
Analista de datos
Experiencia
Initech 03/2021 - Actual
Empresa de software de gestión con clientes en Perú.
Analista de Datos Senior
* Reducción del 30% en el tiempo de los reportes semanales
con Excel y SQL.
+ Tableros de ventas en Power BI para el equipo comercial.
Globex 2018 - 2021
Analista Junior
Certificaciones
Curso de Power BI — 2022
Certificación en SQL avanzado — 2021
Voluntariado
Mentora de análisis de datos en una fundación local
Habilidades
Excel 90%
SQL - 80%
Power BI`

const cv: CV = cvSchema.parse({
  header: { fullName: "Ana Zapata", headline: "Analista de datos", email: "ana@ejemplo.com", links: [] },
  experience: [
    { company: "Globex", role: "Analista Junior", startDate: "2018", endDate: "2021", bullets: [] },
    { company: "Initech", role: "Analista de Datos Senior", startDate: "03/2021", endDate: "Actual", bullets: [] },
  ],
  education: [
    { institution: "Universidad Nacional", degree: "Licenciatura", startDate: "2013", endDate: "2017", details: [] },
    { institution: "Platzi", degree: "Curso de SQL", details: [] },
  ],
  skills: [{ items: ["Excel"] }],
})

const raw = {
  roles: [{ company: "Initech", role: "Analista de Datos Senior", companyNote: "Empresa de software de gestión con clientes en Perú." }],
  certifications: ["Curso de Power BI — 2022", "Certificación en SQL avanzado — 2021"],
  volunteering: ["Mentora de análisis de datos en una fundación local"],
  skillGroups: [],
  projects: [],
}

describe("lectura profunda: solo lo que el texto original contiene", () => {
  it("conserva fragmentos copiados (aunque el OCR parta la línea) y descarta lo inventado", () => {
    const g = groundExtras({ ...raw, certifications: [...raw.certifications, "Certificación en Kubernetes — 2023"] }, SOURCE)
    expect(g.roles[0].bullets).toHaveLength(2)
    expect(g.certifications).toEqual(raw.certifications)
    expect(g.roles[0].companyNote).toBe("Empresa de software de gestión con clientes en Perú.")
  })
  it("descarta un puesto cuya empresa o contenido no está en el texto", () => {
    expect(groundExtras({ ...raw, roles: [{ company: "Umbrella", role: "Jefa" }] }, SOURCE).roles).toEqual([])
  })
  it("las viñetas las lee el código por bloques del texto original (marcador + líneas de continuación), sin IA", () => {
    const g = groundExtras({ ...raw, roles: [...raw.roles, { company: "Globex", role: "Analista Junior" }] }, SOURCE)
    expect(g.roles[0].bullets).toEqual(["* Reducción del 30% en el tiempo de los reportes semanales con Excel y SQL.", "+ Tableros de ventas en Power BI para el equipo comercial."])
  })
  it("comparable ignora tildes, mayúsculas, signos y guiones de corte de línea", () => {
    expect(comparable("Reducción del 30%\nen el tiempo")).toBe(comparable("reduccion del 30 en el  tiempo"))
    expect(comparable("infor-\nmación")).toBe("informacion")
  })
  it("los porcentajes de dominio dejan solo el nombre de la herramienta", () => {
    expect(cleanSkillItem("Figma Design tool- 100%")).toBe("Figma")
    expect(cleanSkillItem("SQL - 80%")).toBe("SQL")
    expect(cleanSkillItem("Power BI")).toBe("Power BI")
  })
})

describe("extractExtras", () => {
  const fake = (out: unknown | Error): AIProvider => ({ name: "fake", async generateStructured(req) { if (out instanceof Error) throw out; return { data: req.schema.parse(out), meta: { provider: "fake", model: "fake", ms: 1, attempts: 1 } } as never } })
  it("devuelve lo anclado al texto", async () => {
    const r = await extractExtras(cv, SOURCE, { provider: fake(raw) })
    expect(r.extras.certifications).toHaveLength(2)
    expect(r.reason).toBeUndefined()
  })
  it("sin texto original o sin IA, no hay extras y no falla", async () => {
    expect((await extractExtras(cv, undefined, { provider: fake(raw) })).reason).toBe("sin-texto")
    expect((await extractExtras(cv, SOURCE, { provider: fake(new AIError("unreachable", "x")) })).reason).toBe("ia-no-disponible")
  })
})

describe("documento ATS con la lectura profunda", () => {
  const extras: AtsExtras = groundExtras(raw, SOURCE)
  it("rellena viñetas vacías, nota de empresa, certificaciones y voluntariado en el orden de plantilla", () => {
    const doc = buildAtsDoc(cv, { extras })
    const text = atsToText(doc)
    expect(text).toContain("• Reducción del 30% en el tiempo de los reportes semanales con Excel y SQL.")
    expect(text).toContain("Empresa de software de gestión con clientes en Perú.")
    expect(doc.sections.map((s) => s.key)).toEqual(["experience", "education", "certifications", "skills", "volunteering"])
    expect(doc.warnings.map((w) => w.code)).toContain("extras-used")
  })
  it("no pisa viñetas que el análisis general ya trajo", () => {
    const own = cvSchema.parse({ ...cv, experience: [{ ...cv.experience[1], bullets: ["Mi propia viñeta."] }] })
    expect(withExtras(own, extras).experience[0].bullets).toEqual(["Mi propia viñeta."])
  })
  it("habilidades rotas (párrafos, porcentajes) se reemplazan solo si hay habilidades recuperadas", () => {
    const broken = cvSchema.parse({ ...cv, skills: [{ items: ["Excel 90%", "x".repeat(55)] }] })
    expect(skillsLookBroken(broken)).toBe(true)
    expect(withExtras(broken, extras).skills).toEqual(broken.skills)
    const withSkills = groundExtras({ ...raw, skillGroups: [{ items: ["Excel 90%", "SQL - 80%", "Power BI"] }] }, SOURCE)
    expect(withExtras(broken, withSkills).skills[0].items).toEqual(["Excel", "SQL", "Power BI"])
  })
  it("con la experiencia rota, manda la lectura anclada del texto original y las fechas se toman del puesto equivalente", () => {
    const broken = cvSchema.parse({ ...cv, experience: [{ company: "Initech, empresa de software de gestión con clientes en Perú. Analista de Datos Senior * Reducción", role: "Analista de Datos Senior", startDate: "03/2021", endDate: "Actual", bullets: [] }, cv.experience[0]] })
    const src = groundExtras({ roles: [{ company: "Initech", role: "Analista de Datos Senior", startDate: "03/2021", endDate: "Actual" }, { company: "Globex", role: "Analista Junior", startDate: "2018", endDate: "2021" }], certifications: [], volunteering: [], skillGroups: [], projects: [] }, SOURCE)
    const out = withExtras(broken, src)
    expect(out.experience.map((e) => e.company)).toEqual(["Initech", "Globex"])
    expect(out.experience[0].bullets).toHaveLength(2)
    expect(out.experience[0].startDate).toBe("03/2021")
    // la fecha de fin que la IA no devolvió se toma del puesto equivalente (mismo año de inicio)
    const noEnd = withExtras(broken, groundExtras({ roles: [{ company: "Initech", role: "Analista de Datos Senior", startDate: "03/2021" }, { company: "Globex", role: "Analista Junior" }], certifications: [], volunteering: [], skillGroups: [], projects: [] }, SOURCE))
    expect(noEnd.experience[0].endDate).toBe("Actual")
    expect(experienceLooksBroken(broken)).toBe(true)
    expect(experienceLooksBroken(cvSchema.parse({ ...cv, experience: [{ ...cv.experience[1], bullets: ["Hice A."] }] }))).toBe(false)
  })
  it("una certificación que ya está en Educación no se repite", () => {
    const withEdu = cvSchema.parse({ ...cv, education: [{ institution: "Platzi", degree: "Curso de Power BI", details: [] }] })
    const doc = buildAtsDoc(withEdu, { extras })
    const cert = doc.sections.find((s) => s.key === "certifications")!.blocks.map((b) => (b.kind === "para" ? b.text : ""))
    expect(cert).toEqual(["Certificación en SQL avanzado — 2021"])
  })
  it("sin extras, el documento es el de siempre", () => {
    expect(atsToText(buildAtsDoc(cv))).not.toContain("Certificaciones")
  })
})

describe("fechas y resumen (A5)", () => {
  it("estudios sin fecha no generan el aviso de orden: van al final y lo demás se ordena", () => {
    const doc = buildAtsDoc(cv)
    expect(doc.warnings.map((w) => w.code)).not.toContain("order-kept")
    const edu = doc.sections.find((s) => s.key === "education")!.blocks.map((b) => (b.kind === "entry" ? b.head : ""))
    expect(edu[0]).toContain("Universidad Nacional")
    expect(edu[1]).toContain("Platzi")
    const exp = doc.sections.find((s) => s.key === "experience")!.blocks.map((b) => (b.kind === "entry" ? b.head : ""))
    expect(exp[0]).toContain("Initech")
  })
  it("una fecha escrita pero ilegible sí avisa y respeta el orden original", () => {
    const odd = cvSchema.parse({ ...cv, experience: [{ ...cv.experience[0], startDate: "verano", endDate: "otoño" }, cv.experience[1]] })
    expect(buildAtsDoc(odd).warnings.map((w) => w.code)).toContain("order-kept")
  })
  it("un resumen largo se corta en frases completas (≤ 4 frases y ≤ 400 caracteres) sin reescribirlo", () => {
    const long = "Diseñador con enfoque en productos digitales. Apasionado por la claridad. Colaborativo y meticuloso. Busca elevar la calidad del diseño. Más de 7 años con equipos de producto. Disponible para tiempo completo."
    const t = trimSummary(long)
    expect(t.cut).toBe(true)
    expect(long.startsWith(t.text)).toBe(true)
    expect(t.text.endsWith(".")).toBe(true)
    expect(t.text.length).toBeLessThanOrEqual(400)
    expect(trimSummary("Corto y claro.").cut).toBe(false)
  })
  it("el resumen largo del CV genera el aviso «summary-cut»", () => {
    const long = Array.from({ length: 7 }, (_, i) => `Frase número ${i + 1} del resumen original.`).join(" ")
    expect(buildAtsDoc(cvSchema.parse({ ...cv, summary: long })).warnings.map((w) => w.code)).toContain("summary-cut")
  })
})

describe("de punta a punta: generar con lectura profunda y verificar (100 %)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => POST(new Request("http://x/api/ats", init)))
  })
  afterEach(() => vi.unstubAllGlobals())
  it("el generador usa los extras recibidos sin volver a leer, y el archivo queda validado", async () => {
    const extras = groundExtras(raw, SOURCE)
    const boom: AIProvider = { name: "boom", async generateStructured() { throw new Error("no debía llamarse la IA") } }
    const g = await generateAts(cv, { extras, sourceText: SOURCE, provider: boom })
    expect(atsToText(g.doc)).toContain("Certificaciones")
    const bundle = await generateAtsClient(cv, SOURCE, () => {}, undefined, extras)
    expect(bundle.extras?.certifications).toHaveLength(2)
    const view = await verifyAtsClient(cv, SOURCE, bundle)
    expect(view.percent).toBeGreaterThanOrEqual(90)
    expect(view.validated).toBe(true)
  }, 60_000)
})
