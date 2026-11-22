import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BodyStep } from "@/components/jobs/apply-email-body-step"
import type { useEmailBody } from "@/components/jobs/use-email-body"
import { DEFAULT_SETTINGS } from "@/lib/apply/body-settings"

type Email = ReturnType<typeof useEmailBody>
const noop = () => {}
const email = (over: Partial<Email> = {}): Email =>
  ({
    proposals: [{ id: 0, middle: null, source: "base" }],
    index: 0,
    current: { id: 0, middle: null, source: "base" },
    body: "Hola, equipo de Vos Consultora:\n\nCuerpo base",
    loading: false,
    settings: DEFAULT_SETTINGS,
    setSettings: noop,
    includeWeb: false,
    setIncludeWeb: noop,
    links: [],
    hasWebFromCv: false,
    extraUrl: null,
    addUrl: () => true,
    removeUrl: noop,
    edit: noop,
    go: noop,
    generate: noop,
    ensureGenerated: noop,
    ...over,
  }) as Email

describe("paso «Cuerpo»", () => {
  it("muestra el texto base y el botón de otras versiones; el portafolio y los ajustes viven en el drawer aparte", () => {
    const html = renderToStaticMarkup(<BodyStep email={email()} />)
    expect(html).toContain("Cuerpo base")
    expect(html).toContain("Pedir otras versiones")
    // los ajustes viven en un drawer aparte: aquí solo hay un botón para abrirlo
    expect(html).toContain('aria-label="Ajustes de redacción"')
    expect(html).not.toContain("Longitud")
    expect(html).not.toContain('id="mail-url"')
    expect(html).not.toContain("Tu portafolio o web")
    // sin propuestas extra no hay flechas
    expect(html).not.toContain("Propuesta anterior")
  })
  it("con varias propuestas muestra las flechas y la posición", () => {
    const p = [{ id: 0, middle: null, source: "base" as const }, { id: 1, middle: "x", source: "ia" as const }, { id: 2, middle: "y", source: "plantilla" as const }]
    const html = renderToStaticMarkup(<BodyStep email={email({ proposals: p, index: 1, current: p[1] })} />)
    expect(html).toContain("Propuesta anterior")
    expect(html).toContain("Propuesta siguiente")
    expect(html).toMatch(/2\s*(<!-- -->)?\s*de\s*(<!-- -->)?\s*3/)
    expect(html).toContain("Redactada con IA local")
  })
  it("mientras la IA redacta muestra el cargador y bloquea el botón", () => {
    const html = renderToStaticMarkup(<BodyStep email={email({ loading: true })} />)
    expect(html).toContain("Escribiendo propuestas…")
    expect(html).toContain('data-variant="orbit"')
    expect(html).toContain('aria-busy="true"')
  })
})
