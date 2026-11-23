import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/ats/route"
import { generateAtsClient, verifyAtsClient } from "@/lib/ats/client"
import { cvSchema, type CV } from "@/lib/schemas/cv"

const base = {
  header: { fullName: "Ana Zapata Núñez", headline: "Analista de datos", email: "ana@ejemplo.com", phone: "+00 000 000 000", location: "Lima, Perú", links: [] },
  experience: [
    { company: "Globex", role: "Analista Junior", startDate: "Ene 2018", endDate: "Dic 2020", bullets: ["Coordiné a 3 personas en la migración de informes."] },
    { company: "Initech", role: "Analista de Datos Senior", startDate: "03/2021", endDate: "Actual", bullets: ["Reduje en 30% el tiempo de los reportes semanales con Excel y SQL."] },
  ],
  education: [{ institution: "Universidad Nacional", degree: "Licenciatura", field: "Estadística", startDate: "2013", endDate: "2017", details: [] }],
  skills: [{ category: "Herramientas", items: ["Excel", "SQL"] }],
}
const withSummary: CV = cvSchema.parse({ ...base, summary: "Analista con experiencia en reportes de ventas y consultas SQL. Trabaja con equipos comerciales." })
const noSummary: CV = cvSchema.parse(base)

const req = (body: unknown) => new Request("http://x/api/ats", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } })

beforeEach(() => {
  // El cliente llama a /api/ats: aquí responde directamente la ruta.
  vi.stubGlobal("fetch", (_url: string, init: RequestInit) => POST(new Request("http://x/api/ats", init)))
})
afterEach(() => vi.unstubAllGlobals())

describe("POST /api/ats · validación de la solicitud", () => {
  it("rechaza un CV inválido, una acción desconocida y una verificación sin archivos", async () => {
    expect((await POST(req({ action: "generate", cv: { nada: 1 } }))).status).toBe(400)
    expect((await POST(req({ action: "otra", cv: withSummary }))).status).toBe(400)
    expect((await POST(req({ action: "verify", cv: withSummary }))).status).toBe(400)
    expect((await POST(new Request("http://x/api/ats", { method: "POST", body: "no es json" }))).status).toBe(400)
  })
})

describe("generar la versión ATS (cliente + ruta)", () => {
  it("con resumen propio: etapas 0 → 2, PDF y Word reales, nombres Nombre-Apellido-Cargo", async () => {
    const stages: number[] = []
    const b = await generateAtsClient(withSummary, (i) => stages.push(i))
    expect(stages).toEqual([0, 2])
    expect(b.pdf.name).toBe("Ana-Zapata-Nunez-Analista-de-datos.pdf")
    expect(b.docx.name).toBe("Ana-Zapata-Nunez-Analista-de-datos.docx")
    expect(atob(b.pdf.base64).slice(0, 5)).toBe("%PDF-")
    expect(atob(b.docx.base64).slice(0, 2)).toBe("PK")
    expect(b.pdf.blob.type).toBe("application/pdf")
    expect(b.pages).toBe(1)
    expect(b.summary).toBeNull()
    expect(b.summaryFromCv).toBe(true)
  }, 60_000)

  it("sin resumen y sin Ollama: pasa por la etapa del resumen, no inventa nada y lo avisa", async () => {
    const stages: number[] = []
    const b = await generateAtsClient(noSummary, (i) => stages.push(i))
    expect(stages).toEqual([0, 1, 2])
    expect(b.summary).toBeNull()
    expect(b.summaryFromCv).toBe(false)
    expect(b.summaryReason).toBe("ia-no-disponible")
  }, 60_000)

  it("avisa cuando un cargo se escribió sin abreviatura", async () => {
    const cv = cvSchema.parse({ ...base, summary: "Analista con experiencia en reportes.", header: { ...base.header, headline: "Ssr. Analista de datos" } })
    const b = await generateAtsClient(cv, () => {})
    expect(b.warnings.join(" ")).toMatch(/Ssr\..*Semi Senior/)
  }, 60_000)
})

describe("verificar la versión ATS (cliente + ruta)", () => {
  it("un CV generado por nosotros queda «Validado» (100 %), con grupos por tema y sin el detalle de las reglas", async () => {
    const b = await generateAtsClient(withSummary, () => {})
    const view = await verifyAtsClient(withSummary, b)
    expect(view).toMatchObject({ percent: 100, label: "listo", validated: true })
    expect(view.groups.map((g) => g.label)).toEqual(["Archivo y estructura", "Tipografía y márgenes", "Secciones y orden", "Datos de contacto", "Experiencia y educación", "Contenido fiel a tu CV"])
    expect(view.groups.every((g) => g.status === "ok")).toBe(true)
    expect(view.formats.map((f) => f.format)).toEqual(["pdf", "docx"])
    expect(Object.keys(view).sort()).toEqual(["disclaimer", "formats", "groups", "label", "labelText", "percent", "validated"])
    expect(JSON.stringify(view)).not.toMatch(/ATS-[A-Z]\d/)
    expect(view.disclaimer).toMatch(/no garantiza/)
  }, 90_000)

  it("archivos de otro CV: no se valida y el grupo de contenido queda «por revisar»", async () => {
    const other = cvSchema.parse({ ...base, header: { ...base.header, fullName: "Luis Gómez" }, summary: "Analista con experiencia en reportes de ventas y consultas SQL. Trabaja con equipos comerciales." })
    const b = await generateAtsClient(other, () => {})
    const view = await verifyAtsClient(withSummary, b)
    expect(view.validated).toBe(false)
    expect(view.percent).toBeLessThanOrEqual(69)
    expect(view.groups.find((g) => g.group === "contenido")?.status).toBe("revisar")
  }, 90_000)

  it("archivos dañados: error claro en español, sin romper", async () => {
    const b = await generateAtsClient(withSummary, () => {})
    await expect(verifyAtsClient(withSummary, { ...b, docx: { ...b.docx, base64: Buffer.from("no es un word").toString("base64") } })).rejects.toThrow(/No se pudo verificar/)
  }, 90_000)
})
