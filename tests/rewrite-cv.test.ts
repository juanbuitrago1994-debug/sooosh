import { beforeEach, describe, expect, it, vi } from "vitest"

type Call = { system: string; user: string }
const calls: Call[] = []
let script: ((call: Call, n: number) => { items: string[] }) | null = null
let failWith: Error | null = null
vi.mock("@/lib/ai", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai")>()),
  getProvider: () => ({
    name: "mock",
    generateStructured: (r: Call) => {
      calls.push({ system: r.system, user: r.user })
      if (failWith) return Promise.reject(failWith)
      return Promise.resolve({ data: script!(r, calls.length), meta: {} })
    },
  }),
}))

import { AIError } from "@/lib/ai"
import { MAX_RETRIES, REWRITE_SYSTEM_PROMPT, rewriteGroup } from "@/lib/ai/rewrite-cv"
import { POST } from "@/app/api/rewrite/route"
import { cvSchema } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"

const cv = cvSchema.parse({
  header: { fullName: "Ana Zapata" },
  summary: "Analista de datos con 4 años de experiencia.",
  experience: [
    { company: "Initech", role: "Analista", startDate: "2021", bullets: ["Reduje en 30% el tiempo de los reportes con Excel.", "Armé tableros de ventas en Power BI."] },
  ],
})
const offer: Offer = { title: "Analista", language: "es", requirements: ["Excel", "Kubernetes"], niceToHave: [], responsibilities: [] }
const req = (body: unknown) => new Request("http://x/api/rewrite", { method: "POST", body: JSON.stringify(body) })

/** Simula al modelo: responde un texto por cada texto numerado del prompt, aplicando `fn`. */
const texts = (c: Call) => [...c.user.split("Textos a reformular:\n")[1].split("\n\n")[0].matchAll(/^\d+\. (.*)$/gm)].map((m) => m[1])
const respond = (fn: (text: string, n: number) => string) => (c: Call, n: number) => ({ items: texts(c).map((t) => fn(t, n)) })

beforeEach(() => {
  calls.length = 0
  script = null
  failWith = null
})

describe("rewriteGroup", () => {
  it("pide salida estructurada y prohíbe inventar en el prompt", async () => {
    script = () => ({ items: ["Con Excel reduje en 30% el tiempo de los reportes.", "Armé tableros de ventas en Power BI."] })
    await rewriteGroup(cv, offer, "exp.0")
    expect(calls[0].system).toBe(REWRITE_SYSTEM_PROMPT)
    expect(calls[0].system).toMatch(/PROHIBIDO añadir/)
    expect(calls[0].user).toContain("1. Reduje en 30%")
    expect(calls[0].user).toContain("Puesto: Analista, Initech")
  })

  it("una reformulación legítima queda como 'changed' y lo idéntico como 'unchanged'", async () => {
    script = () => ({ items: ["Con Excel reduje en 30% el tiempo de los reportes.", "Armé tableros de ventas en Power BI."] })
    const items = await rewriteGroup(cv, offer, "exp.0")
    expect(items.map((i) => i.status)).toEqual(["changed", "unchanged"])
    expect(items[0].proposed).toBe("Con Excel reduje en 30% el tiempo de los reportes.")
    expect(items[0].original).toBe("Reduje en 30% el tiempo de los reportes con Excel.")
    expect(calls).toHaveLength(1)
  })

  it("si inventa una cifra, reintenta con la razón y acepta la corrección", async () => {
    script = respond((t, n) => (t.startsWith("Reduje") ? (n === 1 ? "Reduje en 60% el tiempo de los reportes con Excel." : "Con Excel reduje en 30% el tiempo de los reportes.") : t))
    const items = await rewriteGroup(cv, offer, "exp.0")
    expect(calls).toHaveLength(2)
    expect(calls[1].user).toMatch(/RECHAZADA/)
    expect(calls[1].user).toMatch(/«60»/)
    expect(items.map((i) => i.status)).toEqual(["changed", "unchanged"])
  })

  it("si sigue inventando tras los reintentos, conserva el original (máx. 1 + 2 llamadas)", async () => {
    script = respond((t) => (t.startsWith("Reduje") ? "Reduje en 60% el tiempo con Kubernetes." : "Armé tableros con Tableau."))
    const items = await rewriteGroup(cv, offer, "exp.0")
    expect(calls).toHaveLength(1 + MAX_RETRIES)
    expect(items.map((i) => i.status)).toEqual(["kept", "kept"])
    expect(items.map((i) => i.proposed)).toEqual(items.map((i) => i.original))
    expect(items[0].reasons?.join(" ")).toMatch(/60/)
  })

  it("solo reintenta los textos rechazados", async () => {
    script = (c, n) => {
      if (n === 1) return { items: ["Con Excel reduje en 30% el tiempo de los reportes.", "Armé tableros con Tableau."] }
      expect(c.user).toContain("1. Armé tableros de ventas en Power BI.")
      expect(c.user).not.toContain("Reduje en 30%")
      return { items: ["Construí tableros de ventas en Power BI."] }
    }
    const items = await rewriteGroup(cv, offer, "exp.0")
    expect(calls).toHaveLength(2)
    expect(items.map((i) => i.status)).toEqual(["changed", "changed"])
  })

  it("un término de la oferta que el CV no tiene (minúsculas) también se rechaza", async () => {
    script = respond((t) => (t.startsWith("Reduje") ? "Reduje en 30% el tiempo de los reportes con Excel y kubernetes." : t))
    const items = await rewriteGroup(cv, offer, "exp.0")
    expect(items[0].status).toBe("kept")
    expect(items[0].reasons?.join(" ")).toMatch(/Kubernetes/)
  })

  it("rechaza respuestas con otra cantidad de textos o que alargan demasiado", async () => {
    script = () => ({ items: ["Solo uno."] })
    const short = await rewriteGroup(cv, offer, "exp.0")
    expect(short.map((i) => i.status)).toEqual(["kept", "kept"])
    expect(short[0].reasons?.join(" ")).toMatch(/un texto por cada elemento/)
    script = () => ({ items: ["Reduje en 30% el tiempo de los reportes con Excel. " + "Además hice muchas otras cosas útiles. ".repeat(5), "Armé tableros de ventas en Power BI."] })
    expect((await rewriteGroup(cv, offer, "exp.0"))[0].status).toBe("kept")
  })

  it("reescribe el resumen", async () => {
    script = () => ({ items: ["Analista de datos con 4 años de experiencia en reportes."] })
    // «reportes» no está en el resumen pero sí en otra parte del CV → es un dato propio, vale
    expect(await rewriteGroup(cv, offer, "summary")).toMatchObject([{ id: "summary", status: "changed" }])
  })
})

describe("fuente de verdad inmutable (guard)", () => {
  it("un dato que está en el texto ORIGINAL pasa aunque ya no esté en el CV editable", async () => {
    const guard = "Texto original del CV. Usé Airflow para orquestar los reportes semanales con Excel."
    script = respond((t) => (t.startsWith("Reduje") ? "Con Airflow y Excel reduje en 30% el tiempo de los reportes." : t))
    const items = await rewriteGroup(cv, offer, "exp.0", undefined, `${guard}\nReduje en 30% el tiempo de los reportes con Excel.`)
    expect(items[0].status).toBe("changed")
  })
  it("un dato que no está ni en el CV ni en el texto original se rechaza", async () => {
    script = respond((t) => (t.startsWith("Reduje") ? "Con Airflow y Excel reduje en 30% el tiempo de los reportes." : t))
    const items = await rewriteGroup(cv, offer, "exp.0", undefined, "Reduje en 30% el tiempo de los reportes con Excel.")
    expect(items[0].status).toBe("kept")
    expect(items[0].reasons?.join(" ")).toMatch(/Airflow/)
  })
  it("la ruta acepta el campo guard y lo usa", async () => {
    script = respond((t) => (t.startsWith("Reduje") ? "Con Airflow y Excel reduje en 30% el tiempo de los reportes." : t))
    const guard = "Airflow Excel Reduje en 30% el tiempo de los reportes con Excel. Armé tableros de ventas en Power BI."
    const res = await POST(req({ cv, offer, group: "exp.0", guard }))
    expect((await res.json()).items[0].status).toBe("changed")
  })
})

describe("POST /api/rewrite", () => {
  it("devuelve los items verificados", async () => {
    script = () => ({ items: ["Con Excel reduje en 30% el tiempo de los reportes.", "Armé tableros de ventas en Power BI."] })
    const res = await POST(req({ cv, offer, group: "exp.0" }))
    expect(res.status).toBe(200)
    expect((await res.json()).items).toHaveLength(2)
  })
  it("valida el grupo y los datos", async () => {
    expect((await POST(req({ cv, offer, group: "exp.9" }))).status).toBe(400)
    expect((await POST(req({ cv: {}, offer, group: "summary" }))).status).toBe(400)
  })
  it("si Ollama no está disponible responde 503 con mensaje en español", async () => {
    failWith = new AIError("unreachable", "No se pudo conectar con Ollama en http://x. ¿Está corriendo (ollama serve)?")
    const res = await POST(req({ cv, offer, group: "summary" }))
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe("unreachable")
  })
})
