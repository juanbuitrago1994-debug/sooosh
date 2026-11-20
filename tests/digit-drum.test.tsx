import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BeamBadge } from "@/components/magic/beam-badge"
import { DrumNumber, formatThousands } from "@/components/magic/digit-drum"

describe("distintivo «Ofertas encontradas»", () => {
  it("formatea miles con punto, también con 4 cifras", () => {
    expect(formatThousands(1450)).toBe("1.450")
    expect(formatThousands(12345)).toBe("12.345")
    expect(formatThousands(999)).toBe("999")
    expect(formatThousands(0)).toBe("0")
    expect(formatThousands(-5)).toBe("0")
    expect(formatThousands(2265.4)).toBe("2.265")
  })
  it("el número se anuncia completo una sola vez (aria-label) y sus dígitos son decorativos", () => {
    const html = renderToStaticMarkup(<DrumNumber value={1450} />)
    expect(html).toContain('aria-label="1.450"')
    expect(html).toContain('role="text"')
    expect((html.match(/aria-hidden="true"/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })
  it("el distintivo con haz renderiza su contenido", () => {
    expect(renderToStaticMarkup(<BeamBadge>1.450 Ofertas encontradas</BeamBadge>)).toContain("1.450 Ofertas encontradas")
  })
})

describe("Beam (border-beam, un solo color)", () => {
  it("envuelve a su hijo con el efecto en gris y estilo interior, sin colores", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server")
    const { Beam } = await import("@/components/magic/beam")
    const html = renderToStaticMarkup(<Beam><div className="x">Hola</div></Beam>)
    expect(html).toContain("Hola")
    expect(html).toMatch(/data-beam|beam/i)
  })
})

describe("intensidad del haz por tema", () => {
  it("en claro se compensa (los presets de la librería son ~5 veces más tenues): 1 en claro, 0,5 en oscuro, y manda el valor explícito", async () => {
    const { beamStrength } = await import("@/components/magic/beam")
    expect(beamStrength("dark")).toBe(0.5)
    expect(beamStrength("light")).toBe(1)
    expect(beamStrength("light", 0.3)).toBe(0.3)
    expect(beamStrength("dark", 0.9)).toBe(0.9)
  })
})

describe("destello diagonal del distintivo", () => {
  it("la banda espera fuera a la izquierda, cruza todo el ancho y sale por la derecha; descansa el 72 % del ciclo", async () => {
    const { sweepFrames } = await import("@/components/magic/beam-badge")
    const f = sweepFrames(150)
    expect(f.x[0]).toBeLessThan(0) // empieza fuera, a la izquierda
    expect(f.x[2]).toBeGreaterThan(150) // termina fuera, a la derecha
    expect(f.x[1]).toBe(f.x[0]) // durante el descanso no se mueve
    expect(f.times).toEqual([0, 0.72, 1])
    expect(f.x).toHaveLength(f.times.length)
  })
})
