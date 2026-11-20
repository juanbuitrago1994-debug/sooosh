import { afterEach, describe, expect, it, vi } from "vitest"
import { DbTimeoutError, withDbTimeout } from "@/lib/db/timeout"

afterEach(() => vi.useRealTimers())

describe("límite de espera de la base", () => {
  it("devuelve el resultado si llega a tiempo", async () => {
    await expect(withDbTimeout(Promise.resolve(42), 50)).resolves.toBe(42)
  })
  it("una consulta atascada falla con un error claro en vez de colgarse", async () => {
    vi.useFakeTimers()
    const stuck = new Promise<never>(() => {})
    const r = withDbTimeout(stuck, 12_000)
    const assertion = expect(r).rejects.toBeInstanceOf(DbTimeoutError)
    await vi.advanceTimersByTimeAsync(12_001)
    await assertion
  })
  it("si la consulta falla antes, se propaga su error", async () => {
    await expect(withDbTimeout(Promise.reject(new Error("falló")), 50)).rejects.toThrow("falló")
  })
})
