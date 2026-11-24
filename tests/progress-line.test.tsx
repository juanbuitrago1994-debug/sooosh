import { readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ProgressLine } from "@/components/ai/progress-line"
import { SearchLoading } from "@/components/jobs/search-loading"
import { MOTION, TRANSITION_SOFT } from "@/lib/motion"

describe("ProgressLine: spinner + frase + porcentaje en una línea", () => {
  it("muestra el spinner de shadcn, la frase sin puntos suspensivos y el porcentaje, y se anuncia como estado", () => {
    const html = renderToStaticMarkup(<ProgressLine messages={["Leyendo tu CV…"]} percent={42} label="Avance" />)
    expect(html).toContain('data-slot="spinner"')
    expect(html).toContain("Leyendo tu CV")
    expect(html).not.toMatch(/…|\.\.\./)
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-valuenow="42"')
    expect(html).toContain("42 %")
    expect(html).toContain('role="status"')
  })
  it("la carga de ofertas usa el mismo patrón, empieza en 0 % y entra con la animación suave", () => {
    const html = renderToStaticMarkup(<SearchLoading />)
    expect(html).toContain("Buscando entre las ofertas")
    expect(html).toContain("0 %")
    expect(html).toContain('data-slot="spinner"')
    // las tres piezas arrancan ocultas (opacity 0) para entrar una tras otra
    expect(html.match(/opacity:0/g)?.length).toBeGreaterThanOrEqual(3)
  })
  it("la entrada suave es más lenta que la estándar y escalona las piezas; solo opacity, blur y translate", () => {
    expect(MOTION.enterSoft).toBeGreaterThan(MOTION.enter)
    expect(TRANSITION_SOFT.duration).toBe(MOTION.enterSoft)
    expect(MOTION.softStagger).toBeGreaterThan(0)
    const src = readFileSync(path.join(__dirname, "..", "components/ai/progress-line.tsx"), "utf8")
    expect(src).not.toMatch(/rotate|conic-gradient|mask|scale/)
  })
  it("la lista de ofertas ya no usa el cargador de puntos cuadrado ni frases con «…»", () => {
    const src = readFileSync(path.join(__dirname, "..", "components/jobs/job-search.tsx"), "utf8")
    expect(src).toContain("<SearchLoading />")
    expect(src).not.toContain("LoadingState")
    expect(src).not.toContain("SEARCH_MESSAGES")
  })
})
