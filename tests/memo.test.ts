import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createMemo } from "@/lib/util/memo"

describe("memoria de corta vida", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("la misma clave dentro del tiempo no vuelve a cargar; pasado el tiempo, sí", async () => {
    const memo = createMemo<number>({ ttlMs: 1000, max: 10 })
    const load = vi.fn(async () => 42)
    expect(await memo("a", load)).toBe(42)
    expect(await memo("a", load)).toBe(42)
    expect(load).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1001)
    await memo("a", load)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("peticiones iguales a la vez comparten una sola carga", async () => {
    const memo = createMemo<string>({ ttlMs: 1000, max: 10 })
    let n = 0
    const load = () => new Promise<string>((r) => setTimeout(() => r(`v${++n}`), 50))
    const all = Promise.all([memo("k", load), memo("k", load), memo("k", load)])
    vi.advanceTimersByTime(60)
    expect(await all).toEqual(["v1", "v1", "v1"])
  })

  it("un fallo no se guarda; un resultado que `keep` rechaza tampoco", async () => {
    const memo = createMemo<number | null>({ ttlMs: 1000, max: 10 })
    const bad = vi.fn().mockRejectedValueOnce(new Error("red")).mockResolvedValue(7)
    await expect(memo("x", bad)).rejects.toThrow("red")
    expect(await memo("x", bad)).toBe(7)
    expect(bad).toHaveBeenCalledTimes(2)

    const nul = vi.fn().mockResolvedValueOnce(null).mockResolvedValue(5)
    expect(await memo("n", nul, (v) => v !== null)).toBeNull()
    await Promise.resolve()
    expect(await memo("n", nul, (v) => v !== null)).toBe(5) // el null no quedó guardado
    expect(nul).toHaveBeenCalledTimes(2)
  })

  it("respeta el máximo: saca la entrada más vieja", async () => {
    const memo = createMemo<number>({ ttlMs: 10_000, max: 2 })
    const load = vi.fn(async () => 1)
    await memo("a", load)
    await memo("b", load)
    await memo("c", load)
    await memo("a", load) // «a» ya no está: se vuelve a cargar
    expect(load).toHaveBeenCalledTimes(4)
  })
})
