import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { CV } from "@/lib/schemas/cv"

const cv = { header: { fullName: "Ana Pérez", links: [] }, experience: [], education: [], skills: [], languages: [], projects: [] } as unknown as CV

async function render(profile: { cv: CV } | null, emails = ["candidatos@consultoravos.com", "rrhh@consultoravos.com"]) {
  vi.resetModules()
  vi.doMock("@/lib/profile/search-profile", () => ({ useSearchProfile: () => profile }))
  vi.doMock("@/components/ui/drawer", () => {
    const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
    return { Drawer: Pass, DrawerContent: Pass, DrawerHeader: Pass, DrawerFooter: Pass, DrawerTitle: Pass, DrawerDescription: Pass }
  })
  const { ApplyEmailPanel } = await import("@/components/jobs/apply-email-panel")
  return renderToStaticMarkup(<ApplyEmailPanel open onOpenChange={() => {}} job={{ title: "Diseñador/a UX/UI", company: "Vos Consultora" }} emails={emails} covered={[]} />)
}

afterEach(() => vi.doUnmock("@/lib/profile/search-profile"))

describe("panel de correo", () => {
  it("paso 1: muestra los correos detectados y el progreso de 4 pasos", async () => {
    const html = await render({ cv })
    expect(html).toContain("Paso 1 de 4")
    expect(html).toContain("candidatos@consultoravos.com")
    expect(html).toContain("rrhh@consultoravos.com")
    for (const s of ["1. Destinatario", "2. Asunto", "3. Cuerpo", "4. Listo"]) expect(html).toContain(s)
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-current="step"')
  })
  it("paso 1: permite agregar otro correo a mano", async () => {
    const html = await render({ cv })
    expect(html).toContain("Agregar otro correo")
    expect(html).toContain('id="mail-add"')
    expect(html).toContain('type="email"')
  })
  it("sin CV pide cargarlo y no inventa nada", async () => {
    const html = await render(null)
    expect(html).toContain("Primero carga tu CV")
    expect(html).not.toContain("candidatos@consultoravos.com")
  })
})
