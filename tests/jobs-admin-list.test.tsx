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
  it("el filtro «Manuales» llega al servidor", async () => {
    const { GET } = await import("@/app/api/jobs/route")
    await GET(new Request("http://x/api/jobs?q=&only=manuales"))
    expect(listJobs).toHaveBeenLastCalledWith({}, { q: undefined, only: "manuales" })
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

describe("carga del análisis en el distintivo", () => {
  it("el distintivo sin haz conserva su aspecto y no dibuja la luz; con haz sí", async () => {
    vi.doMock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }))
    const { BeamBadge } = await import("@/components/magic/beam-badge")
    const plain = renderToStaticMarkup(<BeamBadge beam={false}>cargando</BeamBadge>)
    const withBeam = renderToStaticMarkup(<BeamBadge>cargando</BeamBadge>)
    expect(plain).toContain("rounded-full")
    expect(plain).not.toContain("mask-image")
    expect(plain).not.toContain("conic-gradient")
    expect(withBeam).toContain("conic-gradient")
  })
  it("la versión pequeña del cargador cabe en el distintivo y usa el barrido por columnas", async () => {
    const { LoadingState } = await import("@/components/ai/loading-state")
    const html = renderToStaticMarkup(<LoadingState size="sm" messages={["Leyendo la oferta…"]} />)
    expect(html).toContain('data-variant="scan"')
    expect(html).toContain("text-xs")
    expect(html).toContain("w-36")
    expect(html).not.toContain("w-64")
  })
})

describe("insignia rosa «Curated by Sooosh»", () => {
  it("usa los colores documentados y el texto completo", async () => {
    const { CuratedBadge } = await import("@/components/magic/curated-badge")
    const { EFFECT_COLORS } = await import("@/lib/design-tokens")
    const html = renderToStaticMarkup(<CuratedBadge />)
    expect(html).toContain("Curated by Sooosh")
    expect(html).toContain(EFFECT_COLORS["curated-bg"])
    expect(html).toContain(EFFECT_COLORS["curated-fg"])
  })
})
