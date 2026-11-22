import { describe, expect, it, vi } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { Switch } from "@/components/motion/motion-switch"

describe("Switch (toggle de transitions.dev)", () => {
  it("se pinta como interruptor accesible, apagado por defecto", () => {
    const html = renderToStaticMarkup(<Switch aria-label="Teléfono" />)
    expect(html).toContain('role="switch"')
    expect(html).toContain('aria-checked="false"')
    expect(html).toContain('data-slot="switch-thumb"')
  })

  it("respeta checked y el tamaño", () => {
    const html = renderToStaticMarkup(<Switch checked size="sm" aria-label="x" onCheckedChange={vi.fn()} />)
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('data-size="sm"')
  })

  it("al montar no anima: la bolita queda en su sitio (x = recorrido si está encendido)", () => {
    expect(renderToStaticMarkup(<Switch checked aria-label="x" onCheckedChange={vi.fn()} />)).toContain("translateX(14px)")
  })
})
