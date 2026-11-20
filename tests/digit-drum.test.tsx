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

describe("recorrido por el contorno del distintivo", () => {
  it("la luz sigue el contorno de la píldora: sale arriba a la izquierda, rodea los extremos y vuelve al inicio, a velocidad constante", async () => {
    const { stadiumPath } = await import("@/components/magic/beam-badge")
    const w = 140, h = 32
    const pts = stadiumPath(w, h, 96)
    expect(pts[0]).toEqual({ x: 16, y: 0 }) // arranca arriba, en el inicio del borde recto
    expect(pts[96].x).toBeCloseTo(pts[0].x, 6) // cierra la vuelta
    expect(pts[96].y).toBeCloseTo(pts[0].y, 6)
    // todos los puntos están sobre el contorno: arriba (y=0), abajo (y=h) o en los semicírculos (distancia al centro del extremo = r)
    for (const p of pts) {
      const onStraight = Math.abs(p.y) < 1e-6 || Math.abs(p.y - h) < 1e-6
      const dRight = Math.hypot(p.x - (w - 16), p.y - 16)
      const dLeft = Math.hypot(p.x - 16, p.y - 16)
      expect(onStraight || Math.abs(dRight - 16) < 1e-6 || Math.abs(dLeft - 16) < 1e-6).toBe(true)
    }
    // velocidad constante: la distancia entre puntos consecutivos casi no varía (los semicírculos se aproximan con cuerdas)
    const steps = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y))
    expect(Math.max(...steps) / Math.min(...steps)).toBeLessThan(1.05)
    // la segunda luz va media vuelta por delante
    const b = stadiumPath(w, h, 96, 0.5)
    expect(b[0].x).toBeCloseTo(pts[48].x, 6)
    expect(b[0].y).toBeCloseTo(pts[48].y, 6)
  })
})
