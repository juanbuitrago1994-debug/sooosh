import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

const listJobs = vi.fn<(db: unknown, filter: unknown) => Promise<unknown[]>>(async () => [{ id: "1", title: "Diseñadora UX/UI" }])
const countJobs = vi.fn<(db: unknown, filter: unknown) => Promise<number>>(async () => 2627)
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }))
vi.mock("@/lib/jobs/admin", () => ({ requireAdmin: () => null }))
vi.mock("@/lib/jobs/embed", () => ({ embedJob: vi.fn() }))
vi.mock("@/lib/sources/companies", () => ({ addCompany: vi.fn(), parseAtsUrl: vi.fn() }))
vi.mock("@/lib/jobs/store", () => ({ listJobs: (db: unknown, f: unknown) => listJobs(db, f), countJobs: (db: unknown, f: unknown) => countJobs(db, f), jobDraftSchema: { safeParse: vi.fn() }, upsertJob: vi.fn() }))

describe("lista de tarjetas del panel", () => {
  it("pasa el texto y el filtro al servidor y devuelve el total (no solo las primeras)", async () => {
    const { GET } = await import("@/app/api/jobs/route")
    const r = await GET(new Request("http://x/api/jobs?q=dise%C3%B1o&only=incompletas"))
    expect(await r.json()).toEqual({ jobs: [{ id: "1", title: "Diseñadora UX/UI" }], total: 2627 })
    expect(listJobs).toHaveBeenCalledWith({}, { q: "diseño", only: "incompletas" })
    expect(countJobs).toHaveBeenCalledWith({}, { q: "diseño", only: "incompletas" })
  })
  it("un filtro desconocido se ignora y un texto vacío no filtra", async () => {
    const { GET } = await import("@/app/api/jobs/route")
    await GET(new Request("http://x/api/jobs?q=&only=cualquier-cosa"))
    expect(listJobs).toHaveBeenLastCalledWith({}, { q: undefined, only: undefined })
  })
})

describe("pantalla del panel", () => {
  it("sin clave solo pide la clave: sin textos de relleno", async () => {
    vi.doMock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
    const { JobsAdmin } = await import("@/components/jobs/jobs-admin")
    const html = renderToStaticMarkup(<JobsAdmin />)
    expect(html).toContain("Clave de administrador")
    expect(html).not.toContain("ADMIN_TOKEN")
    expect(html).not.toContain(".env.local")
  })
})
