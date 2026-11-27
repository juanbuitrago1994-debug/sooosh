import { describe, expect, it } from "vitest"
import { DEFAULT_LENS as LENS, LENS_RANGES, easeInOutPower, lensFrame } from "@/lib/lens/frame"
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
    expect(easeInOutPower(0, 2.2)).toBeCloseTo(0, 10)
    expect(easeInOutPower(1, 2.2)).toBeCloseTo(1)
    expect(easeInOutPower(0.5, 2.2)).toBeCloseTo(0.5)
    expect(easeInOutPower(0.3, 1)).toBeCloseTo(0.3) // potencia 1 = lineal
    expect(easeInOutPower(0.2, 3)).toBeLessThan(easeInOutPower(0.2, 1.5)) // más potencia = arranque más lento y más ímpetu después
    expect(Math.abs(lensFrame(0.401).lensY - lensFrame(0.4).lensY)).toBeLessThan(0.01)
  })
  it("los valores por defecto son ágiles (≤ 1 s), con color y estela presentes pero ligeros, y con curvatura global suave", () => {
    expect(LENS.durationMs).toBeLessThanOrEqual(1000)
    expect(LENS.dispersion).toBeGreaterThan(0)
    expect(LENS.dispersion).toBeLessThanOrEqual(0.25) // «muy ligera»
    expect(LENS.prism).toBeGreaterThan(0)
    expect(LENS.prism).toBeLessThanOrEqual(0.02)
    expect(LENS.colorPeak).toBeLessThan(0.5) // el color vive en la primera mitad
    expect(LENS.blur).toBeGreaterThan(0)
    expect(LENS.widthFactor).toBeGreaterThan(1)
    expect(LENS.curve).toBeGreaterThan(0)
    expect(LENS.curve).toBeLessThanOrEqual(0.2) // «la curvatura es muy grande» → suave
    expect(LENS.renderScale).toBeLessThan(1)
  })
  it("el color es breve: llega al máximo al comienzo, se apaga mucho antes que la deformación y es cero al terminar", () => {
    expect(lensFrame(LENS.colorPeak).color).toBeCloseTo(1, 5)
    expect(lensFrame(0).color).toBeLessThan(0.3) // se insinúa desde el principio, sin saltar
    for (const p of [0.55, 0.7, 0.85, 1]) expect(lensFrame(p).color, `p=${p}`).toBeLessThan(0.02)
    // mientras el color ya es invisible, la lupa sigue deformando
    expect(lensFrame(0.6).bulge).toBeGreaterThan(0.5)
    // y el color nunca dura más que la deformación: en el tramo final solo queda lupa
    expect(lensFrame(0.7).color).toBeLessThan(lensFrame(0.7).bulge)
  })
  it("cada parámetro del panel de ajuste tiene un rango que contiene su valor por defecto", () => {
    for (const [k, [min, max]] of Object.entries(LENS_RANGES)) {
      const v = LENS[k as keyof typeof LENS] as number
      expect(v, k).toBeGreaterThanOrEqual(min)
      expect(v, k).toBeLessThanOrEqual(max)
    }
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
