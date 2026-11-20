import { describe, expect, it, vi } from "vitest"

const countPlatformJobs = vi.fn(async () => 2625)
vi.mock("@/lib/db", () => ({ getDb: () => ({}) }))
vi.mock("@/lib/jobs/search", () => ({ countPlatformJobs: () => countPlatformJobs() }))

describe("total de la plataforma (distintivo inicial)", () => {
  it("devuelve el total de toda la plataforma y se puede cachear 60 s", async () => {
    const { GET } = await import("@/app/api/jobs/count/route")
    const r = await GET()
    expect(r.status).toBe(200)
    expect(await r.json()).toEqual({ total: 2625 })
    expect(r.headers.get("cache-control")).toContain("s-maxage=60")
  })
  it("si la base falla responde 502 sin detalles internos", async () => {
    countPlatformJobs.mockRejectedValueOnce(new Error("postgres://user:secreto@host/db"))
    const { GET } = await import("@/app/api/jobs/count/route")
    const r = await GET()
    expect(r.status).toBe(502)
    expect(JSON.stringify(await r.json())).not.toContain("secreto")
  })
})
