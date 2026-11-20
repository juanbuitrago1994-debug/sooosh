import { beforeEach, describe, expect, it, vi } from "vitest"

const embedQuery = vi.fn(async () => [0.1, 0.2])
const searchJobs = vi.fn(async () => ({ jobs: [], semantic: false, total: 1450 }))
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }))
vi.mock("@/lib/jobs/embed", () => ({ embedQuery: (...a: unknown[]) => embedQuery(...(a as [])), embedProfile: vi.fn(async () => null) }))
vi.mock("@/lib/jobs/search", () => ({ searchJobs: (...a: unknown[]) => searchJobs(...(a as [])), getJobCards: vi.fn(async () => []) }))
vi.mock("@/lib/events/server", () => ({ affinityFor: vi.fn(async () => []) }))

const post = async (body: object) => {
  const { POST } = await import("@/app/api/search/route")
  return POST(new Request("http://x/api/search", { method: "POST", body: JSON.stringify(body) }))
}

describe("búsqueda en vivo (fast)", () => {
  beforeEach(() => {
    embedQuery.mockClear()
    searchJobs.mockClear()
  })
  it("mientras se escribe (fast) solo busca por texto: no calcula el vector de la consulta", async () => {
    const r = await post({ region: "LATAM", q: "diseñ", fast: true })
    expect(r.status).toBe(200)
    expect((await r.json()).total).toBe(1450) // el total viene de la búsqueda, no de la página
    expect(embedQuery).not.toHaveBeenCalled()
    expect(searchJobs).toHaveBeenCalledOnce()
  })
  it("con la búsqueda completa sí suma el significado", async () => {
    await post({ region: "LATAM", q: "diseñador UX" })
    expect(embedQuery).toHaveBeenCalledOnce()
  })
})
