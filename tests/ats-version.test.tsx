import { readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cvSchema, type CV } from "@/lib/schemas/cv"
import { combineReports, groupSummary, type AtsReport } from "@/lib/ats/verify"

const cv: CV = cvSchema.parse({ header: { fullName: "Ana Pérez", headline: "Diseñadora", email: "ana@ejemplo.com" }, experience: [{ company: "Acme", role: "Diseñadora", startDate: "2020", bullets: ["Diseñé flujos."] }] })

async function panel(profile: { cv: CV; label: string; updatedAt: string } | null) {
  vi.resetModules()
  vi.doMock("@/lib/profile/search-profile", () => ({ useSearchProfile: () => profile, setSearchProfile: () => true, setAtsStatus: () => true, clearSearchProfile: () => {} }))
  const { SearchProfilePanel } = await import("@/components/jobs/search-profile-panel")
  const Pass = ({ children, className }: { children?: React.ReactNode; className?: string }) => <div className={className}>{children}</div>
  return renderToStaticMarkup(<SearchProfilePanel shell={{ Header: Pass, Title: Pass, Description: Pass }} />)
}
afterEach(() => vi.doUnmock("@/lib/profile/search-profile"))

describe("panel «Mi CV» (panel lateral)", () => {
  it("con CV: la tarjeta del CV (`CvFileCard`) con «Cambiar» (con confirmación; ya no hay «Quitar») y el bloque Versión ATS; sin hoja animada ni degradado", async () => {
    const html = await panel({ cv, label: "Ana Pérez · Diseñadora", updatedAt: "x" })
    expect(html).toContain("Mi CV")
    expect(html).toContain("Ana Pérez · Diseñadora")
    expect(html).toContain('data-slot="attachment"')
    expect(html).toContain("Cambiar")
    expect(html).not.toContain("Afinidad ATS")
    expect(html).not.toContain("Quitar")
    expect(html).toContain("Sin validar")
    expect(html).toContain("Validar mi CV")
    expect(html).toContain("Versión ATS")
    expect(html).toContain("Generar versión ATS")
    expect(html).not.toContain("Validado")
    expect(html).not.toMatch(/data-cv-|bg-linear|gradient/)
  })
  it("sin CV: solo el recuadro de subida (Attachment idle) que invita a hacer clic o soltar; no ofrece la versión ATS", async () => {
    const html = await panel(null)
    expect(html).toContain('data-state="idle"')
    expect(html).toContain("Sube tu CV")
    expect(html).toContain("Arrastra el archivo o haz clic")
    expect(html).toContain("PDF, Word o imagen")
    expect(html).toContain("flex-1 flex-col")
    expect(html).not.toContain("Generar versión ATS")
    expect(html).not.toContain("Cambiar")
    // la zona de soltar no se muestra hasta que se arrastra un archivo
    expect(html).not.toContain("data-drop-overlay")
  })
  it("todo el panel es zona de soltar: maneja arrastrar y soltar y muestra el aviso con motion (opacity/blur/translate)", () => {
    const src = readFileSync(path.join(__dirname, "..", "components/jobs/search-profile-panel.tsx"), "utf8")
    for (const h of ["onDragEnter", "onDragOver", "onDragLeave", "onDrop"]) expect(src).toContain(h)
    expect(src).toContain("Suelta tu CV aquí")
    expect(src).toContain("useReducedMotion")
    expect(src).not.toMatch(/scale|rotate|conic-gradient/)
    // el beam solo aparece mientras se arrastra: vive dentro del aviso de soltar, nunca en reposo
    // el haz vive solo en la capa compartida (`CvDropOverlay`), que aparece al arrastrar o al leer; nunca en reposo
    expect(src).toContain("<CvDropOverlay")
    const overlay = readFileSync(path.join(__dirname, "..", "components/cv/cv-drop-overlay.tsx"), "utf8")
    expect(overlay.match(/<FlowBeam/g)).toHaveLength(1)
    expect(overlay).toContain("data-drop-overlay")
    expect(src).not.toContain("<FlowBeam")
  })
  it("mientras se lee el CV: sin el cargador cuadrado; el haz recorre el panel y la frase va centrada y sin puntos suspensivos", () => {
    const src = readFileSync(path.join(__dirname, "..", "components/jobs/search-profile-panel.tsx"), "utf8")
    expect(src).not.toContain("LoadingState")
    expect(src).toContain("show={dragging || busy}")
    expect(src).toContain("ReadingStatus")
    expect(readFileSync(path.join(__dirname, "..", "components/cv/reading-status.tsx"), "utf8")).toContain("ProgressLine")
    const reading = readFileSync(path.join(__dirname, "..", "components/cv/reading-status.tsx"), "utf8")
    expect(reading).toMatch(/const GENERIC = \["Leyendo tu CV", "Reconociendo tu experiencia", "Preparando el encaje"\]/)
    expect(reading).not.toMatch(/GENERIC[^\n]*(…|\.\.\.)/)
    // un solo haz para los dos momentos (arrastrar y leer)
    expect(src.match(/<CvDropOverlay/g)).toHaveLength(1)
  })
  it("sin CV y al arrastrar usan el mismo mensaje (mismo ícono, orden y tamaños): un solo DropMessage para ambos", () => {
    const src = readFileSync(path.join(__dirname, "..", "components/jobs/search-profile-panel.tsx"), "utf8")
    expect(src.match(/<DropMessage/g)).toHaveLength(2)
    expect(src).toContain("Suelta tu CV aquí")
    expect(src).toContain("Sube tu CV")
  })
  it("al generar la versión ATS solo la primera parte (título, subtítulo y tarjeta del CV) sube y se oculta con motion; el resto no cambia, y cada paso lleva su porcentaje", () => {
    const panelSrc = readFileSync(path.join(__dirname, "..", "components/jobs/search-profile-panel.tsx"), "utf8")
    expect(panelSrc).toContain("atsWorking")
    expect(panelSrc).toContain('y: "-100%"')
    expect(panelSrc).toContain("inert={atsWorking}")
    const atsSrc = readFileSync(path.join(__dirname, "..", "components/jobs/ats-version.tsx"), "utf8")
    expect(atsSrc).toContain("<StepPercent")
    // el bloque «Versión ATS» conserva su título y su descripción mientras se genera
    expect(atsSrc).not.toMatch(/working \? "sr-only"/)
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
      ({ percent, label, labelText: label, file: { format }, rules: [{ id: "ATS-F1", group: "archivo", status }], tips: [], readRate: 100, readback: [] }) as unknown as AtsReport
    const ok = combineReports([rep("pdf", 100, "listo", "pass"), rep("docx", 100, "listo", "pass")])
    expect(ok).toMatchObject({ percent: 100, validated: true })
    const mix = combineReports([rep("pdf", 100, "listo", "pass"), rep("docx", 82, "casi", "fail")])
    expect(mix).toMatchObject({ percent: 82, validated: false, label: "casi" })
    expect(mix.groups[0].status).toBe("revisar")
  })
})
