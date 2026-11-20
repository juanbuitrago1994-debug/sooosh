import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const read = (p: string) => readFileSync(p, "utf8")
const ENTRY_FILES = ["components/wizard/entry-screen.tsx", "components/dropzone.tsx", "components/glass-panel.tsx"]

describe("UI v2 · pantalla de Entrada (criterios verificables por código)", () => {
  it.each(ENTRY_FILES)("%s: sin font-serif, Card, border-dashed ni sombras", (f) => {
    const s = read(f)
    expect(s).not.toMatch(/font-serif|font-heading/)
    expect(s).not.toMatch(/\bCard\b|components\/ui\/card/)
    expect(s).not.toMatch(/border-dashed|border-2|shadow-/)
  })

  it.each(["components/wizard/entry-screen.tsx", "components/dropzone.tsx"])("%s: solo tamaños de la escala (xs, sm, base, lg) y pesos 400/500", (f) => {
    const s = read(f)
    const sizes = [...s.matchAll(/\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|\[[^\]]+\])\b/g)].map((m) => m[1])
    for (const size of sizes) expect(["xs", "sm", "base", "lg"]).toContain(size)
    expect(s).not.toMatch(/font-(semibold|bold|extrabold|black|light|thin)/)
    expect(s).not.toMatch(/-\[[^\]]+\]/) // sin valores arbitrarios
  })

  it("una sola familia sans: Newsreader eliminada y --font-heading apunta a Geist", () => {
    expect(read("app/fonts.ts")).not.toMatch(/Newsreader|serif/i)
    expect(read("app/layout.tsx")).not.toMatch(/newsreader/i)
    const css = read("app/globals.css")
    expect(css).toMatch(/--font-heading:\s*var\(--font-geist-sans\)/)
    expect(css).not.toMatch(/newsreader/i)
  })

  it("botones: h-9 por defecto, radio completo y área táctil de 44 px (size-11) para punteros táctiles", () => {
    const s = read("components/ui/button.tsx")
    expect(s).toMatch(/default:\s*\n?\s*"h-9 /)
    expect(s).toMatch(/rounded-full/)
    expect(s).toMatch(/pointer-coarse:after:size-11/)
  })

  it("el shell completo (marco de todos los pasos) ya no usa Card", () => {
    expect(read("components/wizard/wizard.tsx")).not.toMatch(/\bCard\b|components\/ui\/card/)
  })

  it("todas las pantallas del recorrido (perfil, oferta, análisis, revisión y exportar) usan el estilo v2: sin cajas, Alert ni tipografía grande", () => {
    for (const f of ["components/steps/step-profile.tsx", "components/cv/diagnosis-card.tsx", "components/cv/profile-summary.tsx", "components/steps/step-export.tsx", "components/steps/step-offer.tsx", "components/steps/step-analysis.tsx", "components/steps/step-review.tsx"]) {
      const s = read(f)
      expect(s).not.toMatch(/font-heading|text-(xl|2xl|3xl|4xl|5xl)|bg-muted(?!-)|<Alert\b|<Card\b|border-dashed/)
    }
  })
})
