import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { BodyStep } from "@/components/jobs/apply-email-body-step"
import type { useEmailBody } from "@/components/jobs/use-email-body"
import { DEFAULT_SETTINGS } from "@/lib/apply/body-settings"
import { DEFAULT_CONTACT } from "@/lib/apply/email"

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
    contact: DEFAULT_CONTACT,
    setContact: noop,
    available: { phone: true, email: true, city: false, linkedin: false, web: false, source: false },
    cvValues: {},
    asks: [],
    askValues: {},
    setAskValue: noop,
    missingAsks: [],
    resetEdit: noop,
    links: [],
    hasWebFromCv: false,
    extraUrl: null,
    addUrl: () => true,
    removeUrl: noop,
    edit: noop,
    go: noop,
    generate: async () => {},
    ensureGenerated: noop,
    ...over,
  }) as Email

describe("paso «Cuerpo»", () => {
  it("muestra el texto base y un solo botón hacia los ajustes y otras versiones; el portafolio y los ajustes viven en el drawer aparte", () => {
    const html = renderToStaticMarkup(<BodyStep email={email()} />)
    expect(html).toContain("Cuerpo base")
    expect(html).toContain("Ajustes y otras versiones")
    expect(html).not.toContain("Pedir otras versiones")
    // los ajustes viven en un drawer aparte: aquí solo hay un botón para abrirlo
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
  it("sin nada que pedir no muestra el bloque «La oferta pide»", () => {
    expect(renderToStaticMarkup(<BodyStep email={email()} />)).not.toContain("La oferta pide en el correo")
  })
  it("muestra un campo por cada dato que pide la oferta y avisa que no se inventa", () => {
    const html = renderToStaticMarkup(<BodyStep email={email({ asks: ["salario", "disponibilidad", "linkedin", "portafolio"] })} />)
    expect(html).toContain("La oferta pide en el correo")
    expect(html).toContain("no inventamos nada")
    expect(html).toContain('id="ask-salario"')
    expect(html).toContain('id="ask-disponibilidad"')
    expect(html).toContain('id="ask-linkedin"')
    expect(html).toContain('id="ask-web-url"')
    expect(html).not.toContain('id="ask-referencias"')
  })
  it("si el CV ya trae LinkedIn y portafolio, ofrece incluirlos en vez de pedirlos", () => {
    const html = renderToStaticMarkup(<BodyStep email={email({ asks: ["linkedin", "portafolio"], available: { phone: true, email: true, city: false, linkedin: true, web: true, source: false }, hasWebFromCv: true })} />)
    expect(html).toContain("Incluir mi LinkedIn")
    expect(html).toContain("Incluir mi portafolio o web")
    expect(html).not.toContain('placeholder="linkedin.com/in/tu-perfil"')
    expect(html).not.toContain('id="ask-web-url"')
  })
  it("un texto editado a mano avisa y permite restaurarlo", () => {
    const html = renderToStaticMarkup(<BodyStep email={email({ current: { id: 0, middle: null, source: "base", override: "x" } })} />)
    expect(html).toContain("Editaste este texto")
    expect(html).toContain("Restaurar")
  })
})
