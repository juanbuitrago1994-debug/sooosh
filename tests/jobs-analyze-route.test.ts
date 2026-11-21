import { beforeEach, describe, expect, it, vi } from "vitest"

const generate = vi.fn()
const resolve = vi.fn<(u: string) => Promise<string | undefined>>()
vi.mock("@/lib/ai", async (orig) => ({ ...(await orig<typeof import("@/lib/ai")>()), getProvider: () => ({ name: "mock", generateStructured: (r: unknown) => generate(r) }) }))
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }))
vi.mock("@/lib/jobs/admin", () => ({ requireAdmin: () => null }))
vi.mock("@/lib/jobs/store", () => ({ findJobByUrl: async () => null }))
vi.mock("@/lib/offer/short-links", async (orig) => ({ ...(await orig<typeof import("@/lib/offer/short-links")>()), resolveShortLink: (u: string) => resolve(u) }))

import { POST } from "@/app/api/jobs/analyze/route"

const BODY = `Estamos seleccionando Diseñador/a UX/UI para sumarse al equipo de una empresa en crecimiento.  ¿Qué buscamos?
🔹 Experiencia comprobable en diseño de interfaces (UI) e investigación de experiencia de usuario (UX).
🔹 Dominio de Figma y sistemas de diseño (Design Systems).
🔹 Trabajo en equipo junto a desarrolladores y área de producto.
🔹 Modalidad: Remoto.
📩 ¿Cómo postularte? Envianos tu CV a candidatos@consultoravos.com. O cargá tus datos en este link: https://lnkd.in/d92iP43G`

const post = (body: unknown) => POST(new Request("http://x/api/jobs/analyze", { method: "POST", body: JSON.stringify(body) }))

beforeEach(() => {
  generate.mockReset()
  resolve.mockReset()
  resolve.mockImplementation(async (u) => (u.includes("/p/") ? "https://www.linkedin.com/posts/x-123/" : "https://forms.gle/U13v4492isxwh9aJ9"))
  generate.mockImplementation(async (r: { user: string }) => {
    const lines = r.user.replace(/^Líneas:\n/, "").split("\n").map((l) => l.replace(/^\d+: /, ""))
    return { data: { title: 0, company: null, requirements: lines.flatMap((l, i) => (/^\s*🔹/.test(l) && !/modalidad/i.test(l) ? [i] : [])), niceToHave: [], responsibilities: [] }, meta: { provider: "mock", model: "m", ms: 1, attempts: 1 } }
  })
})

describe("POST /api/jobs/analyze con texto pegado", () => {
  it("la empresa que escribe la persona manda y la evidencia lo dice", async () => {
    const r = await (await post({ text: BODY, company: "Vos Consultora" })).json()
    expect(r.draft.company).toBe("Vos Consultora")
    expect(r.evidence.find((e: { key: string }) => e.key === "empresa")).toMatchObject({ status: "texto", quote: "La escribiste tú" })
  })
  it("sin empresa escrita ni encabezado, queda sin empresa (no «crecimiento. ¿Qué buscamos?»)", async () => {
    const r = await (await post({ text: BODY })).json()
    expect(r.draft.company).toBeUndefined()
    expect(r.draft.title).toBe("Diseñador/a UX/UI")
    expect(r.draft.offer.requirements).toHaveLength(3)
  })
  it("el encabezado pegado de una página de empresa da la empresa y no queda en el texto", async () => {
    const r = await (await post({ text: `Vos Consultora\n830 seguidores\n3 sem •\n${BODY}` })).json()
    expect(r.draft.company).toBe("Vos Consultora")
    expect(r.evidence.find((e: { key: string }) => e.key === "empresa").quote).toContain("encabezado")
    expect(JSON.stringify(r.draft.offer)).not.toContain("seguidores")
  })
  it("el enlace corto del texto se sigue: el formulario al que lleva es otra vía de postulación", async () => {
    const r = await (await post({ text: BODY })).json()
    expect(resolve).toHaveBeenCalledWith("https://lnkd.in/d92iP43G")
    expect(r.draft.apply.alt).toEqual(expect.arrayContaining([{ method: "formulario", url: "https://forms.gle/U13v4492isxwh9aJ9" }]))
  })
  it("el enlace corto de la propia publicación se resuelve y es la dirección de la tarjeta (no se duplica)", async () => {
    const r = await (await post({ text: BODY, link: "https://lnkd.in/p/ekvnyVQn" })).json()
    expect(r.draft.sourceUrl).toBe("https://linkedin.com/posts/x-123")
    expect(r.draft.apply).toMatchObject({ method: "plataforma", platform: "LinkedIn" })
  })
})
