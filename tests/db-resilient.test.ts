import { beforeEach, describe, expect, it, vi } from "vitest"

const dbs: object[] = []
let resets = 0
vi.mock("@/lib/db", () => {
  let current: object | undefined
  return {
    getDb: () => (current ??= (() => { const d = { id: dbs.length }; dbs.push(d); return d })()),
    resetDb: (failed?: object) => { if (failed && failed !== current) return false; current = undefined; resets++; return true },
  }
})

beforeEach(() => {
  dbs.length = 0
  resets = 0
})

describe("lecturas que se curan solas", () => {
  it("si la consulta se atasca, recrea las conexiones y el reintento responde", async () => {
    const { withDb, stats } = await import("@/lib/db/resilient")
    const before = { ...stats }
    const calls: object[] = []
    const out = await withDb(async (db) => {
      calls.push(db)
      if (calls.length === 1) return new Promise<string>(() => {}) // atascada
      return "ok"
    }, { timeoutMs: 30 })
    expect(out).toBe("ok")
    expect(calls[0]).not.toBe(calls[1]) // el segundo intento usó conexiones nuevas
    expect(resets).toBe(1)
    expect(stats.timeouts).toBe(before.timeouts + 1)
    expect(stats.resets).toBe(before.resets + 1)
    expect(stats.recovered).toBe(before.recovered + 1)
  })
  it("un error que no es de conexión no se reintenta ni recrea nada", async () => {
    const { withDb } = await import("@/lib/db/resilient")
    const fn = vi.fn(async () => { throw new Error("sintaxis") })
    await expect(withDb(fn, { timeoutMs: 30 })).rejects.toThrow("sintaxis")
    expect(fn).toHaveBeenCalledTimes(1)
    expect(resets).toBe(0)
  })
  it("si tampoco el reintento responde, falla con un error claro (no se cuelga)", async () => {
    const { withDb, stats } = await import("@/lib/db/resilient")
    const failed = stats.failed
    await expect(withDb(() => new Promise<string>(() => {}), { timeoutMs: 20, retries: 1 })).rejects.toThrow(/no respondió/)
    expect(stats.failed).toBe(failed + 1)
    expect(resets).toBe(2)
  })
  it("reconoce errores de conexión por código, también dentro de «cause»", async () => {
    const { isConnectionProblem } = await import("@/lib/db/resilient")
    expect(isConnectionProblem(Object.assign(new Error("x"), { code: "ECONNRESET" }))).toBe(true)
    expect(isConnectionProblem(Object.assign(new Error("Failed query"), { cause: { code: "57014" } }))).toBe(true)
    expect(isConnectionProblem(new Error("duplicate key"))).toBe(false)
  })
})
