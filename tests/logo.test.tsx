import { readFileSync } from "node:fs"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Logo, rayLength, WAVE_SECONDS } from "@/components/brand/logo"
import { AppHeader } from "@/components/wizard/app-header"

describe("marca Sooosh", () => {
  it("el logo separa el amanecer (grupo con máscara) del cuadrado y hereda el color del tema", () => {
    const html = renderToStaticMarkup(<Logo className="size-5" />)
    expect(html).toContain("<mask")
    expect(html.match(/<clipPath/g)).toHaveLength(12) // un rayo por cuña
    expect(html).toContain('fill="currentColor"')
    expect(html).toContain('fill-rule="evenodd"')
    expect(html).toContain('aria-hidden="true"')
    expect(readFileSync("components/brand/logo.tsx", "utf8")).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
  it("la cabecera dice «Sooosh» y ya no «CV Tailor»", () => {
    const html = renderToStaticMarkup(<AppHeader actions={{ onLearning: () => {}, onReopen: () => {} }} />)
    expect(html).toContain("Sooosh")
    expect(html).not.toContain("CV Tailor")
  })
})

describe("microinteracción del logo (onda de rayos)", () => {
  it("todos los rayos empiezan y terminan en reposo (largo 1) y ninguno pasa de 1", () => {
    for (let i = 0; i < 12; i++) {
      expect(rayLength(0, i)).toBe(1)
      expect(rayLength(WAVE_SECONDS, i)).toBe(1)
      for (let s = 0; s <= WAVE_SECONDS; s += 0.02) expect(rayLength(s, i)).toBeLessThanOrEqual(1)
    }
  })
  it("los rayos salen escalonados: cada uno empieza a recogerse después del anterior, en círculo", () => {
    const start = (i: number) => {
      for (let s = 0; s <= WAVE_SECONDS; s += 0.005) if (rayLength(s, i) < 0.999) return s
      return Infinity
    }
    for (let i = 1; i < 12; i++) expect(start(i)).toBeGreaterThan(start(i - 1))
  })
  it("cada rayo se recoge hasta el mínimo y vuelve a crecer sin saltos bruscos", () => {
    let min = 1
    let prev = 1
    for (let s = 0; s <= WAVE_SECONDS; s += 0.01) {
      const v = rayLength(s, 3)
      min = Math.min(min, v)
      expect(Math.abs(v - prev)).toBeLessThan(0.2)
      prev = v
    }
    expect(min).toBeCloseTo(0.22, 1)
  })
})
