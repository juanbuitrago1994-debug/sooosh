import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { DOT_VARIANTS, DotLoader, dotDelay } from "@/components/ai/dot-loader"
import { MOTION } from "@/lib/motion"

describe("DotLoader (transitions.dev P33)", () => {
  it("las medidas de la referencia: ciclo de 1,2 s", () => {
    expect(MOTION.loaderCycle).toBe(1.2)
  })
  it("los retardos replican los de la página de referencia (ciclo de 1200 ms)", () => {
    // scan: por columna, ciclo/10 = 120 ms
    expect([0, 1, 2, 3].map((i) => dotDelay("scan", i))).toEqual([0, 120, 240, 360])
    // twinkle: orden al azar fijo × ciclo/16 = 75 ms
    expect(dotDelay("twinkle", 6)).toBe(Math.round(0 * 75)) // TWINKLE[6] = 0
    expect(dotDelay("twinkle", 0)).toBe(Math.round(7 * 75))
    expect(new Set(Array.from({ length: 16 }, (_, i) => dotDelay("twinkle", i))).size).toBe(16)
    // orbit: el perímetro sin esquinas (8 celdas) gira cada ciclo/8 = 150 ms; el centro y las esquinas no animan
    expect([1, 2, 7, 11, 14, 13, 8, 4].map((i) => dotDelay("orbit", i))).toEqual([0, 150, 300, 450, 600, 750, 900, 1050])
    expect(dotDelay("orbit", 5)).toBeNull()
    expect(dotDelay("orbit", 0)).toBeNull()
    // pulse: el centro primero y el borde 0,16 × ciclo después
    expect(dotDelay("pulse", 5)).toBe(0)
    expect(dotDelay("pulse", 0)).toBe(192)
  })
  it("cuatro caracteres de movimiento, 16 puntos y las esquinas se pueden quitar", () => {
    expect(DOT_VARIANTS).toHaveLength(4)
    for (const v of DOT_VARIANTS) expect((renderToStaticMarkup(<DotLoader variant={v} />).match(/size-0\.5/g) ?? []).length).toBe(16)
    const rounded = renderToStaticMarkup(<DotLoader rounded />)
    expect((rounded.match(/invisible/g) ?? []).length).toBe(4)
  })
  it("es decorativo y mide 14 px (size-3.5)", () => {
    const html = renderToStaticMarkup(<DotLoader />)
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain("size-3.5")
  })
})
