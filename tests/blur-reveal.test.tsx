import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BlurReveal } from "@/components/motion/blur-reveal"

describe("BlurReveal (aparece con movimiento y desenfoque)", () => {
  it("oculto no pinta nada; visible pinta su contenido arrancando invisible, desplazado y desenfocado", () => {
    expect(renderToStaticMarkup(<BlurReveal show={false}>Hola</BlurReveal>)).toBe("")
    const html = renderToStaticMarkup(<BlurReveal show>Hola</BlurReveal>)
    expect(html).toContain("Hola")
    expect(html).toContain("opacity:0")
    expect(html).toContain("blur(")
  })
})
