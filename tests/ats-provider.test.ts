import { afterEach, describe, expect, it, vi } from "vitest"

describe("modelo de la versión ATS (A8)", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.doUnmock("@/lib/ai")
  })
  const load = async () => {
    const calls: unknown[] = []
    vi.doMock("@/lib/ai", () => ({ getProvider: (c: unknown) => (calls.push(c), { name: "fake" }) }))
    const m = await import("@/lib/ats/provider")
    return { m, calls }
  }
  it("usa OLLAMA_ATS_MODEL con keepAlive corto (dos modelos de 9 GB a la vez ahogan un equipo de 16 GB)", async () => {
    vi.stubEnv("OLLAMA_ATS_MODEL", "gemma4:e4b")
    const { m, calls } = await load()
    m.atsProvider(0.2)
    expect(calls[0]).toMatchObject({ model: "gemma4:e4b", temperature: 0.2, keepAlive: "2m" })
  })
  it("sin OLLAMA_ATS_MODEL cae al modelo general (model indefinido: lo resuelve OLLAMA_MODEL)", async () => {
    vi.stubEnv("OLLAMA_ATS_MODEL", "")
    const { m, calls } = await load()
    expect(m.atsModel()).toBeUndefined()
    m.atsProvider()
    expect((calls[0] as { model?: string }).model).toBeUndefined()
  })
})
