import { describe, expect, it } from "vitest"
import { LENS, easeInOutSine, lensFrame } from "@/lib/lens/frame"
import { cornerRadius, groupLines } from "@/lib/lens/rasterize"

describe("línea de tiempo del efecto lupa", () => {
  it("empieza con la lente por encima de la pantalla y termina por debajo, sin abombar en los extremos", () => {
    const a = lensFrame(0)
    const z = lensFrame(1)
    expect(a.lensY).toBeCloseTo(LENS.startY)
    expect(a.lensY).toBeGreaterThanOrEqual(1)
    expect(a.bulge).toBeCloseTo(0)
    expect(z.lensY).toBeCloseTo(LENS.endY)
    expect(z.lensY).toBeLessThan(0)
    expect(z.bulge).toBeCloseTo(0, 5) // al terminar la imagen es idéntica a la página real
  })
  it("la lente solo baja (nunca sube) y abomba al máximo a media pasada", () => {
    let prev = Infinity
    for (let i = 0; i <= 100; i++) {
      const f = lensFrame(i / 100)
      expect(f.lensY).toBeLessThanOrEqual(prev + 1e-9)
      expect(f.bulge).toBeGreaterThanOrEqual(0)
      expect(f.bulge).toBeLessThanOrEqual(1)
      prev = f.lensY
    }
    expect(lensFrame(0.5).bulge).toBe(1)
    expect(lensFrame(0.5).lensY).toBeCloseTo((LENS.startY + LENS.endY) / 2)
  })
  it("ignora avances fuera de 0 a 1 y la curva es suave (sin saltos)", () => {
    expect(lensFrame(-3).lensY).toBeCloseTo(LENS.startY)
    expect(lensFrame(9).lensY).toBeCloseTo(LENS.endY)
    expect(easeInOutSine(0)).toBeCloseTo(0, 10)
    expect(easeInOutSine(1)).toBeCloseTo(1)
    expect(easeInOutSine(0.5)).toBeCloseTo(0.5)
    expect(Math.abs(lensFrame(0.401).lensY - lensFrame(0.4).lensY)).toBeLessThan(0.01)
  })
  it("la duración total no pasa de 2,5 s (el login debe ser legible pronto)", () => {
    expect(LENS.durationMs).toBeLessThanOrEqual(2500)
    expect(LENS.strength).toBeLessThan(1) // lupa que agranda, no que encoge
  })
})

describe("foto del DOM", () => {
  it("el radio «de píldora» se limita a la mitad del lado menor", () => {
    expect(cornerRadius("3.35544e+07px", 300, 44)).toBe(22)
    expect(cornerRadius("14px", 36, 36)).toBe(14)
    expect(cornerRadius("0px", 36, 36)).toBe(0)
    expect(cornerRadius("auto", 36, 36)).toBe(0)
  })
  it("parte los caracteres en líneas por su posición y descarta blancos sin caja", () => {
    const ch = (c: string, left: number, top: number, width = 7) => ({ ch: c, left, top, width, height: 16 })
    const lines = groupLines([ch("H", 10, 100), ch("o", 17, 100), ch(" ", 24, 100, 4), ch("\n", 0, 0, 0), ch("m", 12, 118), ch("a", 19, 118), ch(" ", 26, 118, 4)])
    expect(lines).toEqual([
      { text: "Ho", left: 10, top: 100, height: 16 },
      { text: "ma", left: 12, top: 118, height: 16 },
    ])
  })
})
