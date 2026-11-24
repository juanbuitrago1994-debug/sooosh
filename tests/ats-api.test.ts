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
    const b = await generateAtsClient(withSummary, undefined, (i) => stages.push(i))
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
    const b = await generateAtsClient(noSummary, undefined, (i) => stages.push(i))
    expect(stages).toEqual([0, 1, 2])
    expect(b.summary).toBeNull()
    expect(b.summaryFromCv).toBe(false)
    expect(b.summaryReason).toBe("ia-no-disponible")
  }, 60_000)

  it("avisa cuando un cargo se escribió sin abreviatura", async () => {
    const cv = cvSchema.parse({ ...base, summary: "Analista con experiencia en reportes.", header: { ...base.header, headline: "Ssr. Analista de datos" } })
    const b = await generateAtsClient(cv, undefined, () => {})
    expect(b.warnings.join(" ")).toMatch(/Ssr\..*Semi Senior/)
  }, 60_000)
})

describe("verificar la versión ATS (cliente + ruta)", () => {
  it("un CV generado por nosotros queda «Validado» (100 %), con grupos por tema y sin el detalle de las reglas", async () => {
    const b = await generateAtsClient(withSummary, undefined, () => {})
    const view = await verifyAtsClient(withSummary, undefined, b)
    expect(view).toMatchObject({ percent: 100, label: "listo", validated: true })
    expect(view.groups.map((g) => g.label)).toEqual(["Archivo y estructura", "Tipografía y márgenes", "Secciones y orden", "Datos de contacto", "Experiencia y educación", "Contenido fiel a tu CV"])
    expect(view.groups.every((g) => g.status === "ok")).toBe(true)
    expect(view.formats.map((f) => f.format)).toEqual(["pdf", "docx"])
    expect(Object.keys(view).sort()).toEqual(["disclaimer", "formats", "groups", "label", "labelText", "percent", "readRate", "readback", "tips", "validated"])
    expect(JSON.stringify(view)).not.toMatch(/ATS-[A-Z]\d/)
    expect(view.disclaimer).toMatch(/no garantiza/)
  }, 90_000)

  it("archivos de otro CV: no se valida y el grupo de contenido queda «por revisar»", async () => {
    const other = cvSchema.parse({ ...base, header: { ...base.header, fullName: "Luis Gómez" }, summary: "Analista con experiencia en reportes de ventas y consultas SQL. Trabaja con equipos comerciales." })
    const b = await generateAtsClient(other, undefined, () => {})
    const view = await verifyAtsClient(withSummary, undefined, b)
    expect(view.validated).toBe(false)
    expect(view.percent).toBeLessThanOrEqual(69)
    expect(view.groups.find((g) => g.group === "contenido")?.status).toBe("revisar")
  }, 90_000)

  it("archivos dañados: error claro en español, sin romper", async () => {
    const b = await generateAtsClient(withSummary, undefined, () => {})
    await expect(verifyAtsClient(withSummary, undefined, { ...b, docx: { ...b.docx, base64: Buffer.from("no es un word").toString("base64") } })).rejects.toThrow(/No se pudo verificar/)
  }, 90_000)
})

describe("lectura profunda en segundo plano (A8)", () => {
  it("la ruta «read» responde sin archivos: sin texto original o sin IA devuelve extras nulos y no falla", async () => {
    const res = await POST(req({ action: "read", cv: noSummary }))
    expect(res.status).toBe(200)
    expect((await res.json()).extras).toBeNull()
  })
  it("dos pedidos de la misma lectura comparten una sola llamada (Ollama es uno solo) y «Generar» espera a la que está en curso", async () => {
    const { readExtrasClient, pendingExtras } = await import("@/lib/ats/client")
    let calls = 0
    vi.stubGlobal("fetch", async () => {
      calls++
      await new Promise((r) => setTimeout(r, 30))
      return new Response(JSON.stringify({ extras: { roles: [], certifications: ["Curso"], volunteering: [], skillGroups: [], projects: [] } }), { status: 200 })
    })
    const src = "x".repeat(300)
    const a = readExtrasClient(noSummary, src)
    const b = readExtrasClient(noSummary, src)
    expect(pendingExtras(noSummary, src)).toBeDefined()
    expect(await a).toEqual(await b)
    expect(calls).toBe(1)
    expect(pendingExtras(noSummary, src)).toBeUndefined()
  })
  it("prefetchExtras guarda lo leído en el perfil solo si sigue siendo el mismo CV", async () => {
    vi.resetModules()
    const saved: unknown[] = []
    vi.doMock("@/lib/profile/search-profile", () => ({ setProfileExtras: (e: unknown, id?: string) => saved.push([e, id]) }))
    vi.doMock("@/lib/ats/client", () => ({ readExtrasClient: async () => ({ roles: [], certifications: [], volunteering: [], skillGroups: [], projects: [] }) }))
    const { prefetchExtras } = await import("@/lib/ats/prefetch")
    prefetchExtras(noSummary, "y".repeat(300), "archivo-1")
    prefetchExtras(noSummary, "corto", "archivo-2") // sin texto suficiente: no hace nada
    await new Promise((r) => setTimeout(r, 10))
    expect(saved).toHaveLength(1)
    expect((saved[0] as unknown[])[1]).toBe("archivo-1")
    vi.doUnmock("@/lib/profile/search-profile")
    vi.doUnmock("@/lib/ats/client")
  })
})
