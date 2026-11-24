import { readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
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

describe("panel «Mi CV» (panel lateral)", () => {
  it("con CV: nombre en un Attachment, Cambiar/Quitar y el bloque Versión ATS; sin hoja animada ni degradado", async () => {
    const html = await panel({ cv, label: "Ana Pérez · Diseñadora", updatedAt: "x" })
    expect(html).toContain("Mi CV")
    expect(html).toContain("Ana Pérez · Diseñadora")
    expect(html).toContain('data-slot="attachment"')
    expect(html).toContain("Cambiar CV")
    expect(html).toContain("Quitar")
    expect(html).toContain("Versión ATS")
    expect(html).toContain("Generar versión ATS")
    expect(html).not.toContain("Validado")
    expect(html).not.toMatch(/data-cv-|bg-linear|gradient/)
  })
  it("sin CV: solo el recuadro de subida (Attachment idle) que invita a hacer clic o soltar; no ofrece la versión ATS", async () => {
    const html = await panel(null)
    expect(html).toContain('data-state="idle"')
    expect(html).toContain("Sube tu CV")
    expect(html).toContain("Haz clic o suéltalo aquí")
    expect(html).not.toContain("Generar versión ATS")
    expect(html).not.toContain("Cambiar CV")
    // la zona de soltar no se muestra hasta que se arrastra un archivo
    expect(html).not.toContain("data-drop-overlay")
  })
  it("todo el panel es zona de soltar: maneja arrastrar y soltar y muestra el aviso con motion (opacity/blur/translate)", () => {
    const src = readFileSync(path.join(__dirname, "..", "components/jobs/search-profile-panel.tsx"), "utf8")
    for (const h of ["onDragEnter", "onDragOver", "onDragLeave", "onDrop"]) expect(src).toContain(h)
    expect(src).toContain("Suelta tu CV aquí")
    expect(src).toContain("useReducedMotion")
    expect(src).not.toMatch(/scale|rotate|conic-gradient/)
  })
  it("se abre como panel lateral flotante, igual que «Postular por correo»", () => {
    const src = readFileSync(path.join(__dirname, "..", "components/jobs/search-profile-panel.tsx"), "utf8")
    expect(src).toContain('swipeDirection="right"')
    expect(src).toContain("FloatingDrawerContent")
  })
  it("la interfaz solo usa tokens del tema: sin colores ni valores arbitrarios", () => {
    for (const f of ["components/jobs/ats-version.tsx", "components/jobs/search-profile-panel.tsx"]) {
      const src = readFileSync(path.join(__dirname, "..", f), "utf8")
      expect(src, f).not.toMatch(/\b(?:bg|text|border|fill|stroke)-(?:red|blue|green|amber|yellow|orange|purple|pink|slate|gray|zinc|neutral|stone|black|white)\b/)
      expect(src, f).not.toMatch(/\b[a-z-]+-\[[^\]]+\]/)
      expect(src, f).not.toMatch(/#[0-9a-fA-F]{3,6}\b/)
    }
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
