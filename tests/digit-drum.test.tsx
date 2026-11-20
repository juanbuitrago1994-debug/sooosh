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
