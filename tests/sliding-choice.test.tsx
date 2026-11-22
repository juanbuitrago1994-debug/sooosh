import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"
import { SlidingChoice } from "@/components/motion/sliding-choice"
import { DEFAULT_SETTINGS } from "@/lib/apply/body-settings"

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
  it("muestra los tres ajustes con su explicación y un botón «Listo»", async () => {
    vi.resetModules()
    vi.doMock("@/components/ui/drawer", () => {
      const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
      return { Drawer: Pass, DrawerContent: Pass, DrawerHeader: Pass, DrawerFooter: Pass, DrawerTitle: Pass, DrawerDescription: Pass }
    })
    const { ApplyEmailSettingsDrawer } = await import("@/components/jobs/apply-email-settings-drawer")
    const html = renderToStaticMarkup(<ApplyEmailSettingsDrawer open onOpenChange={() => {}} settings={DEFAULT_SETTINGS} onChange={() => {}} />)
    for (const t of ["Ajustes de redacción", "Longitud", "Tono", "Enfoque", "Listo"]) expect(html).toContain(t)
    expect(html).toContain("3 o 4 frases: equilibrado.")
    expect(html).toContain("Cálido y empático con el equipo.")
    expect(html).toContain("Cada propuesta destaca algo distinto.")
    expect((html.match(/role="radiogroup"/g) ?? []).length).toBe(3)
    vi.doUnmock("@/components/ui/drawer")
  })
})
