import { readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CvMotion } from "@/components/ai/cv-motion"
import { cvSchema, type CV } from "@/lib/schemas/cv"
import { combineReports, groupSummary, type AtsReport } from "@/lib/ats/verify"

const cv: CV = cvSchema.parse({ header: { fullName: "Ana Pérez", headline: "Diseñadora", email: "ana@ejemplo.com" }, experience: [{ company: "Acme", role: "Diseñadora", startDate: "2020", bullets: ["Diseñé flujos."] }] })

async function panel(profile: { cv: CV; label: string; updatedAt: string } | null) {
  vi.resetModules()
  vi.doMock("@/lib/profile/search-profile", () => ({ useSearchProfile: () => profile, setSearchProfile: () => true, clearSearchProfile: () => {} }))
  const { SearchProfilePanel } = await import("@/components/jobs/search-profile-panel")
  const Pass = ({ children, className }: { children?: React.ReactNode; className?: string }) => <div className={className}>{children}</div>
  return renderToStaticMarkup(<SearchProfilePanel shell={{ Header: Pass, Title: Pass, Description: Pass }} />)
}
afterEach(() => vi.doUnmock("@/lib/profile/search-profile"))

describe("panel «Mi CV»", () => {
  it("con CV: CV animado en reposo, título, nombre, Cambiar/Quitar y el bloque Versión ATS", async () => {
    const html = await panel({ cv, label: "Ana Pérez · Diseñadora", updatedAt: "x" })
    expect(html).toContain('data-cv-motion="idle"')
    expect(html).toContain("Mi CV")
    expect(html).toContain("Ana Pérez · Diseñadora")
    expect(html).toContain("Cambiar CV")
    expect(html).toContain("Quitar")
    // A7: escenario con degradado que se desvanece, CV en un Attachment de shadcn
    expect(html).toContain("data-cv-stage")
    expect(html).toContain("data-cv-fade")
    expect(html).toContain('data-slot="attachment"')
    expect(html).toContain("Versión ATS")
    expect(html).toContain("Generar versión ATS")
    expect(html).not.toContain("Validado")
  })
  it("sin CV: solo invita a subirlo; no ofrece la versión ATS", async () => {
    const html = await panel(null)
    expect(html).toContain("Subir mi CV")
    // A7: estado vacío = recuadro de subida (Attachment «idle» con borde punteado) y los 3 pasos numerados
    expect(html).toContain('data-state="idle"')
    expect(html).toContain("Sube tu CV")
    expect(html).toContain("Haz clic o suelta el archivo aquí")
    expect(html).toMatch(/>1<\/span>[\s\S]*>2<\/span>[\s\S]*>3<\/span>/)
    expect(html).not.toContain("Generar versión ATS")
    expect(html).not.toContain("Cambiar CV")
  })
  it("sigue la regla de espaciado de paneles: 24 px entre bloques (gap-6) y título dentro de la zona con scroll, sin relleno propio", async () => {
    const html = await panel({ cv, label: "Ana", updatedAt: "x" })
    expect(html).toMatch(/gap-6[^"]*overflow-y-auto|overflow-y-auto[^"]*gap-6/)
    expect(html).toContain("p-0")
  })
  it("la interfaz solo usa tokens del tema: sin colores ni valores arbitrarios", () => {
    for (const f of ["components/jobs/ats-version.tsx", "components/jobs/search-profile-panel.tsx", "components/ai/cv-motion.tsx", "components/magic/cv-stage.tsx"]) {
      const src = readFileSync(path.join(__dirname, "..", f), "utf8")
      expect(src, f).not.toMatch(/\b(?:bg|text|border|fill|stroke)-(?:red|blue|green|amber|yellow|orange|purple|pink|slate|gray|zinc|neutral|stone|black|white)\b/)
      expect(src, f).not.toMatch(/\b[a-z-]+-\[[^\]]+\]/)
      expect(src, f).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
    }
  })
})

describe("CvMotion (CV animado monocromático)", () => {
  const lines = (h: string) => (h.match(/data-cv-line/g) ?? []).length
  it("reposo: 9 líneas escritas, sin cubiertas, sin barrido y sin marca", () => {
    const h = renderToStaticMarkup(<CvMotion state="idle" />)
    expect(lines(h)).toBe(9)
    expect(h).not.toMatch(/data-cv-cover|data-cv-sweep|data-cv-check/)
  })
  it("trabajando: una cubierta por línea que se desliza y un barrido tenue", () => {
    const h = renderToStaticMarkup(<CvMotion state="working" />)
    expect((h.match(/data-cv-cover/g) ?? []).length).toBe(9)
    expect(h).toContain("data-cv-sweep")
    expect(h).toContain('data-cv-motion="working"')
  })
  it("listo: líneas escritas y marca de check", () => {
    const h = renderToStaticMarkup(<CvMotion state="done" />)
    expect(h).toContain("data-cv-check")
    expect(h).not.toContain("data-cv-cover")
  })
  it("es decorativo, usa un solo color del tema en tonos y respeta «reducir movimiento»", () => {
    const h = renderToStaticMarkup(<CvMotion />)
    expect(h).toContain('aria-hidden="true"')
    expect([...new Set(h.match(/bg-(?!card|muted)[a-z]+(?=\/|\s|")/g))]).toEqual(["bg-primary"])
    expect(readFileSync(path.join(__dirname, "..", "components/ai/cv-motion.tsx"), "utf8")).toContain("useReducedMotion")
  })
})

describe("validación por grupos (sin detalle)", () => {
  const r = (group: string, status: "pass" | "fail" | "na") => ({ group, status }) as never
  it("un grupo está ok si todas sus reglas aplicables cumplen; uno sin reglas aplicables no se muestra", () => {
    const g = groupSummary([r("archivo", "pass"), r("archivo", "na"), r("tipografía", "pass"), r("tipografía", "fail"), r("contacto", "na")])
    expect(g).toEqual([
      { group: "archivo", label: "Archivo y estructura", status: "ok", failed: 0 },
      { group: "tipografía", label: "Tipografía y márgenes", status: "revisar", failed: 1 },
    ])
  })
  it("al unir PDF y Word gana el peor porcentaje y «Validado» exige «Listo» en ambos", () => {
    const rep = (format: "pdf" | "docx", percent: number, label: AtsReport["label"], status: "pass" | "fail") =>
      ({ percent, label, labelText: label, file: { format }, rules: [{ id: "ATS-F1", group: "archivo", status }], tips: [], readRate: 100 }) as unknown as AtsReport
    const ok = combineReports([rep("pdf", 100, "listo", "pass"), rep("docx", 100, "listo", "pass")])
    expect(ok).toMatchObject({ percent: 100, validated: true })
    const mix = combineReports([rep("pdf", 100, "listo", "pass"), rep("docx", 82, "casi", "fail")])
    expect(mix).toMatchObject({ percent: 82, validated: false, label: "casi" })
    expect(mix.groups[0].status).toBe("revisar")
  })
})
