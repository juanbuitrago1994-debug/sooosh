import { describe, expect, it } from "vitest"
import { DEFAULT_LENS as LENS, LENS_RANGES, easeInOutPower, easeOutPower, lensFrame } from "@/lib/lens/frame"
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
  it("la lente solo baja (nunca sube) y el abombamiento está en su máximo cuando el tiempo frenado llega a la mitad", () => {
    let prev = Infinity
    for (let i = 0; i <= 100; i++) {
      const f = lensFrame(i / 100)
      expect(f.lensY).toBeLessThanOrEqual(prev + 1e-9)
      expect(f.bulge).toBeGreaterThanOrEqual(0)
      expect(f.bulge).toBeLessThanOrEqual(1 + 1e-9)
      prev = f.lensY
    }
    // el máximo de la curva está donde easeOutPower(p) = 0,5
    const pMax = 1 - Math.pow(0.5, 1 / LENS.easePower)
    expect(lensFrame(pMax).bulge).toBeCloseTo(1, 5)
  })
  it("TERMINA SUAVE: la velocidad de la lente, del abombamiento y del color decae hasta cero en el último tramo (nada llega a toda velocidad al final)", () => {
    const step = 0.01
    const speed = (p: number) => {
      const a = lensFrame(p)
      const b = lensFrame(p + step)
      return { lens: Math.abs(b.lensY - a.lensY) / step, bulge: Math.abs(b.bulge - a.bulge) / step, color: Math.abs(b.color - a.color) / step }
    }
    const peak = { lens: 0, bulge: 0, color: 0 }
    for (let p = 0; p < 1; p += step) for (const k of ["lens", "bulge", "color"] as const) peak[k] = Math.max(peak[k], speed(p)[k])
    const last = speed(0.97)
    expect(last.lens).toBeLessThan(peak.lens * 0.12)
    expect(last.bulge).toBeLessThan(peak.bulge * 0.12)
    expect(last.color).toBeLessThan(0.05)
    // y la velocidad de la lente baja siempre de la mitad en adelante (sin acelerones al final)
    let prev = Infinity
    for (let p = 0.4; p < 0.98; p += 0.04) {
      const v = speed(p).lens
      expect(v).toBeLessThanOrEqual(prev + 1e-9)
      prev = v
    }
  })
  it("el efecto es ÁGIL al comienzo: casi el 80 % del recorrido de la lente ocurre en la primera mitad del tiempo", () => {
    const done = (lensFrame(0).lensY - lensFrame(0.5).lensY) / (LENS.startY - LENS.endY)
    expect(done).toBeGreaterThan(0.7)
  })
  it("ignora avances fuera de 0 a 1 y la curva es suave (sin saltos)", () => {
    expect(lensFrame(-3).lensY).toBeCloseTo(LENS.startY)
    expect(lensFrame(9).lensY).toBeCloseTo(LENS.endY)
    expect(easeOutPower(0, 2)).toBe(0)
    expect(easeOutPower(1, 2)).toBe(1)
    expect(easeOutPower(0.5, 2)).toBeCloseTo(0.75) // arranca rápido
    expect(easeOutPower(1, 3) - easeOutPower(0.95, 3)).toBeLessThan(0.001) // y llega con velocidad casi 0
    expect(easeInOutPower(0, 2.2)).toBeCloseTo(0, 10)
    expect(easeInOutPower(1, 2.2)).toBeCloseTo(1)
    expect(easeInOutPower(0.5, 2.2)).toBeCloseTo(0.5)
    expect(easeInOutPower(0.3, 1)).toBeCloseTo(0.3) // potencia 1 = lineal
    expect(easeInOutPower(0.2, 3)).toBeLessThan(easeInOutPower(0.2, 1.5)) // más potencia = arranque más lento y más ímpetu después
    expect(Math.abs(lensFrame(0.401).lensY - lensFrame(0.4).lensY)).toBeLessThan(0.01)
  })
  it("los valores por defecto son ágiles (≤ 1 s), con color y estela presentes pero ligeros, y con curvatura global suave", () => {
    expect(LENS.durationMs).toBeLessThanOrEqual(1000)
    expect(LENS.easePower).toBeGreaterThanOrEqual(2) // frenado final
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
    expect(lensFrame(1 - Math.pow(1 - LENS.colorPeak, 1 / LENS.easePower)).color).toBeCloseTo(1, 5)
    expect(lensFrame(0).color).toBeLessThan(0.3) // se insinúa desde el principio, sin saltar
    for (const p of [0.4, 0.55, 0.7, 0.85, 1]) expect(lensFrame(p).color, `p=${p}`).toBeLessThan(0.02)
    // mientras el color ya es invisible, la lupa sigue deformando
    expect(lensFrame(0.3).bulge).toBeGreaterThan(0.5)
    // y el color nunca dura más que la deformación: en el tramo final solo queda lupa
    expect(lensFrame(0.4).color).toBeLessThan(lensFrame(0.4).bulge)
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
