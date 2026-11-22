import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { SlidingChoice } from "@/components/motion/sliding-choice"
import type { useEmailBody } from "@/components/jobs/use-email-body"
import { DEFAULT_SETTINGS } from "@/lib/apply/body-settings"
import { DEFAULT_CONTACT } from "@/lib/apply/email"

type Email = ReturnType<typeof useEmailBody>
const email = (over: Partial<Email> = {}) => ({ settings: DEFAULT_SETTINGS, setSettings: () => {}, contact: DEFAULT_CONTACT, setContact: () => {}, available: { phone: true, email: true, city: true, linkedin: false, web: false, source: true }, cvValues: { phone: "+57 300 000", email: "ana@x.com", city: "Bogotá" }, links: [], hasWebFromCv: false, extraUrl: null, addUrl: () => true, removeUrl: () => {}, loading: false, generate: async () => {}, recipientName: "", setRecipientName: () => {}, lang: "es", ...over }) as Email

const options = [
  { value: "corto", label: "Corto" },
  { value: "medio", label: "Medio" },
  { value: "largo", label: "Largo" },
]

describe("SlidingChoice (Tabs sliding de transitions.dev)", () => {
  it("es un grupo de radios con la opción activa marcada y una sola en el orden de tabulación", () => {
    const html = renderToStaticMarkup(<SlidingChoice label="Longitud" value="medio" options={options} onValueChange={() => {}} />)
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('aria-label="Longitud"')
    expect((html.match(/role="radio"/g) ?? []).length).toBe(3)
    expect((html.match(/aria-checked="true"/g) ?? []).length).toBe(1)
    expect((html.match(/tabindex="0"/g) ?? []).length).toBe(1)
    expect((html.match(/tabindex="-1"/g) ?? []).length).toBe(2)
  })
  it("la píldora usa la duración (250 ms) y la curva de la referencia, y nace oculta hasta medirse", () => {
    const html = renderToStaticMarkup(<SlidingChoice label="Longitud" value="corto" options={options} onValueChange={() => {}} />)
    expect(html).toContain("transition-duration:250ms")
    expect(html).toContain("transition-property:transform, width, height")
    expect(html).toContain("cubic-bezier(0.22,1,0.36,1)")
    expect(html).toContain("opacity-0")
  })
  it("usa solo tokens del tema (sin colores literales ni valores arbitrarios)", () => {
    const html = renderToStaticMarkup(<SlidingChoice label="Longitud" value="corto" options={options} onValueChange={() => {}} />)
    expect(html).toContain("bg-muted")
    expect(html).toContain("bg-background")
    expect(html).not.toMatch(/#[0-9a-f]{3,6}|\[[0-9.]+(px|rem)\]/i)
  })
})

describe("drawer de ajustes", () => {
  it("muestra los tres ajustes con su explicación y, como acción principal, «Pedir otras versiones»", async () => {
    vi.resetModules()
    vi.doMock("@/components/ui/drawer", () => {
      const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
      return { Drawer: Pass, DrawerContent: Pass, DrawerHeader: Pass, DrawerFooter: Pass, DrawerTitle: Pass, DrawerDescription: Pass }
    })
    const { ApplyEmailSettingsDrawer } = await import("@/components/jobs/apply-email-settings-drawer")
    const html = renderToStaticMarkup(<ApplyEmailSettingsDrawer open onOpenChange={() => {}} email={email()} />)
    for (const t of ["Ajustes de redacción", "Tono", "Longitud", "Idioma", "Qué incluye tu correo", "En el texto", "En la firma", "Más ajustes", "Cerrar", "Pedir otras versiones"]) expect(html).toContain(t)
    expect(html).not.toContain("Vista previa")
    // ya no hay pestañas ni Registro, Calidez, Tipo de lenguaje ni punto de partida
    for (const t of ["Punto de partida", "Personalizado", "Registro", "Calidez", "Tipo de lenguaje", "Contenido"]) expect(html).not.toContain(t)
    expect(html).toContain("Amable y natural, con palabras simples.")
    expect(html).toContain("Usa el idioma de la oferta (ahora: español).")
    // tono, longitud e idioma
    expect((html.match(/role="radiogroup"/g) ?? []).length).toBe(3)
    // «Más ajustes» empieza plegado
    expect(html).not.toContain("Enfoque")
    const busy = renderToStaticMarkup(<ApplyEmailSettingsDrawer open onOpenChange={() => {}} email={email({ loading: true })} />)
    expect(busy).toContain("Escribiendo…")
    expect(busy).toContain('data-variant="orbit"')
    vi.doUnmock("@/components/ui/drawer")
  })

  it("«Qué incluye tu correo» ofrece un interruptor por cada dato que tiene el CV, con su valor, y el campo de portafolio si falta", async () => {
    vi.resetModules()
    const { DataTab } = await import("@/components/jobs/apply-email-settings-drawer")
    const html = renderToStaticMarkup(<DataTab email={email()} sourceName="linkedin" />)
    expect(html).toContain("Qué incluye tu correo")
    expect(html).toContain("Tu nombre siempre va")
    expect(html).toContain("Teléfono")
    expect(html).toContain("+57 300 000")
    expect(html).toContain("ana@x.com")
    expect(html).toContain("Ciudad")
    expect(html).toContain("Bogotá")
    expect(html).toContain("Vi su publicación en LinkedIn")
    // LinkedIn y portafolio no están en el CV: no se ofrece un interruptor para ellos
    expect(html).not.toContain('id="contact-linkedin"')
    expect(html).not.toContain('id="contact-web"')
    expect(html).toContain('id="mail-url"')
    expect(html).toContain('id="contact-phone"')
  })
  it("con portafolio y LinkedIn en el CV ofrece sus interruptores y no pide el campo", async () => {
    vi.resetModules()
    const { DataTab } = await import("@/components/jobs/apply-email-settings-drawer")
    const html = renderToStaticMarkup(
      <DataTab
        email={email({ available: { phone: false, email: false, city: false, linkedin: true, web: true, source: false }, cvValues: { linkedin: "linkedin.com/in/ana" }, links: [{ label: "Portafolio", url: "https://ana.design" }], hasWebFromCv: true })}
        sourceName="manual"
      />,
    )
    expect(html).toContain('id="contact-linkedin"')
    expect(html).toContain('id="contact-web"')
    expect(html).toContain("ana.design")
    expect(html).not.toContain('id="mail-url"')
    // sin datos de contacto ni portafolio, solo queda el campo para agregarlo y el aviso
    const empty = renderToStaticMarkup(<DataTab email={email({ available: { phone: false, email: false, city: false, linkedin: false, web: false, source: false } })} sourceName="manual" />)
    expect(empty).toContain("no trae datos de contacto")
  })
})
