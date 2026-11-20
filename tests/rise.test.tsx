import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Rise, RISE } from "@/components/motion/rise"
import { MOTION } from "@/lib/motion"

describe("entrada de abajo hacia arriba (Rise)", () => {
  it("renderiza su contenido y arranca invisible y desplazado hacia abajo (la animación lo sube)", () => {
    const html = renderToStaticMarkup(<Rise className="x">Hola</Rise>)
    expect(html).toContain("Hola")
    expect(html).toContain("opacity:0")
    expect(html).toContain("translateY(16px)")
  })
  it("es una microinteracción corta y usa la curva de la app", () => {
    expect(RISE.duration).toBeLessThanOrEqual(0.45)
    expect(RISE.travel).toBeLessThanOrEqual(20)
    expect(RISE.step).toBeLessThanOrEqual(0.1)
    expect(MOTION.ease).toEqual([0.22, 1, 0.36, 1])
  })
})
