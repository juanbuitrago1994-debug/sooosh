import { readFileSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { FlowBeam } from "@/components/magic/flow-beam"
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

describe("pantalla inicial del CV: misma experiencia que el panel «Mi CV»", () => {
  const entry = readFileSync(path.join(__dirname, "..", "components/wizard/entry-screen.tsx"), "utf8")
  it("al arrastrar y al leer usa la capa compartida con el haz, el mensaje compartido y la línea spinner + frase + porcentaje", () => {
    expect(entry).toContain("<CvDropOverlay")
    expect(entry).toContain("show={dragging || busy}")
    expect(entry).toContain("<DropMessage")
    expect(entry).toContain("<ReadingStatus")
    expect(entry).not.toMatch(/MatrixLoader|ThinkingTicker|patternForStep/)
    expect(entry).toContain('"Subiendo tu CV"')
  })
  it("en reposo usa el mismo mensaje centrado e ícono en cuadro que el panel «Mi CV» sin CV (DropMessage), no el ícono suelto ni el texto largo de antes", () => {
    expect(entry.match(/<DropMessage/g)).toHaveLength(2) // reposo + arrastrando
    expect(entry).toContain("Sube tu CV")
    expect(entry).toContain("Arrastra el archivo o haz clic")
    expect(entry).not.toMatch(/FileTextIcon|se lee en tu equipo|MAX_UPLOAD_BYTES/)
    // sin el contador «1 de 5», y el cuadro del ícono es pequeño (36 px para un ícono de 16 px) en todos los lugares donde se usa
    expect(entry).not.toMatch(/STEPS|\d de \$\{/)
    const drop = readFileSync(path.join(__dirname, "..", "components/cv/drop-message.tsx"), "utf8")
    expect(drop).toContain("size-9")
    expect(drop).not.toContain("size-14")
  })
  it("el porcentaje sigue la etapa real (-1 mientras sube) y solo se atenúa el contenido al arrastrar", () => {
    expect(entry).toContain('phase === "parsing" ? (work?.step ?? 0) : -1')
    expect(entry).toContain("dragging && !reduce")
  })
})

describe("FlowBeam: vuelta y densidad configurables (la ventana completa pide más velocidad y más densidad que el panel)", () => {
  it("por defecto: vuelta de 5 s y opacidades del panel; la ventana completa: 2,8 s y más denso", () => {
    const base = renderToStaticMarkup(<FlowBeam />)
    expect(base).toContain("fb-spin 5s linear")
    expect(base).toContain("opacity: 0.6;")
    const full = renderToStaticMarkup(<FlowBeam lap={2.8} density={1.7} />)
    expect(full).toContain("fb-spin 2.8s linear")
    expect(full).not.toContain("opacity: 0.6;")
    expect(full.match(/opacity: 1;/g)?.length).toBeGreaterThanOrEqual(2) // hilo y brillo interior al máximo
  })
  it("la pantalla inicial usa el haz rápido y denso; el panel no cambia", () => {
    expect(readFileSync(path.join(__dirname, "..", "components/wizard/entry-screen.tsx"), "utf8")).toContain("beam={{ lap: 2.8, density: 1.7, halo: false, continuous: true }}")
    expect(readFileSync(path.join(__dirname, "..", "components/jobs/search-profile-panel.tsx"), "utf8")).not.toContain("beam={{")
  })
})
