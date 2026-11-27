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

describe("pantalla inicial del CV: aura, mensaje y línea de lectura", () => {
  const entry = readFileSync(path.join(__dirname, "..", "components/wizard/entry-screen.tsx"), "utf8")
  it("al arrastrar y al leer usa el aura de luz (AuraField), el mensaje compartido y la línea spinner + frase + porcentaje; ya no usa el haz", () => {
    expect(entry).toContain("<AuraField")
    expect(entry).toContain("active={active}")
    expect(entry).toContain("const active = dragging || busy")
    expect(entry.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/CvDropOverlay|FlowBeam|beam=/) // el comentario de cabecera puede nombrarlos
    expect(entry).toContain("<DropMessage")
    expect(entry).toContain("<ReadingStatus")
    expect(entry).not.toMatch(/MatrixLoader|ThinkingTicker|patternForStep/)
    expect(entry).toContain('"Subiendo tu CV"')
  })
  it("en reposo usa el mismo mensaje centrado e ícono en cuadro que el panel «Mi CV» sin CV (DropMessage), no el ícono suelto ni el texto largo de antes", () => {
    expect(entry.match(/<DropMessage/g)).toHaveLength(2) // reposo + arrastrando
    expect(entry).toContain("ENTRY_IDLE") // «Sube tu CV para empezar» + la frase explicativa viven en lib/profile/cv-drop.ts
    // esta pantalla solo admite arrastrar (el clic está desactivado a propósito): no promete «haz clic»
    expect(entry).not.toContain("haz clic")
    expect(entry).not.toMatch(/FileTextIcon|se lee en tu equipo|MAX_UPLOAD_BYTES/)
    // sin el contador «1 de 5», y el cuadro del ícono es pequeño (36 px para un ícono de 16 px) en todos los lugares donde se usa
    expect(entry).not.toMatch(/STEPS|\d de \$\{/)
    const drop = readFileSync(path.join(__dirname, "..", "components/cv/drop-message.tsx"), "utf8")
    expect(drop).toContain("size-9")
    expect(drop).not.toContain("size-14")
  })
  it("el porcentaje sigue la etapa real (-1 mientras sube) y el contenido de reposo solo se desvanece (opacidad), sin desenfoque", () => {
    expect(entry).toContain('phase === "parsing" ? (work?.step ?? 0) : -1')
    expect(entry).toContain("animate={{ opacity: active ? 0 : 1 }}")
    expect(entry).not.toMatch(/filter|blur\(/)
  })
  it("las frases cambian con motion (SwapText sin desenfoque) y dicen qué va a pasar; esta pantalla no promete «haz clic»", () => {
    expect(entry).toContain("<SwapText")
    expect(entry).toContain("blur={false}")
    expect(entry).toContain("entryDropCopy")
    expect(entry).not.toContain("haz clic")
  })
})

describe("FlowBeam: fluido (animación en la GPU), con máscaras válidas y vuelta y densidad configurables", () => {
  const src = readFileSync(path.join(__dirname, "..", "components/magic/flow-beam.tsx"), "utf8")
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "")
  it("lo único que se anima es un transform: rotate de una capa ya pintada; sin variables CSS animadas ni filter: blur", () => {
    expect(src).toContain("@keyframes fb-turn { to { transform: rotate(360deg); } }")
    expect(src).toContain('willChange: "transform"')
    // la versión con `--fb-angle` repintaba capas del tamaño de la ventana en el hilo principal en cada fotograma (tirones)
    expect(code).not.toMatch(/@property|--fb-angle|filter:|blur\(/)
  })
  it("las máscaras son estáticas y siguen el contorno redondeado (SVG con trazo del rectángulo redondeado): sin degradados rectos que se sumen en las esquinas ni `content-box` dentro de `mask-image` (valor inválido que dejaba la capa sin máscara)", () => {
    expect(src).toContain("glowMask")
    expect(src).toContain("lineMask")
    expect(src).toContain('rx="${r}"')
    expect(code).not.toMatch(/content-box|maskComposite|WebkitMaskComposite|linear-gradient\(white/)
    // el radio de esquina se lee del contenedor, así la máscara coincide con su contorno
    expect(src).toContain("borderTopLeftRadius")
  })
  it("la vuelta, la densidad y el ancho de la franja: valores por defecto del panel y propiedades para la ventana completa", () => {
    expect(src).toContain("const LAP = 5")
    expect(src).toMatch(/lap = LAP, density = 1/)
    expect(src).toContain("const band = 14")
    // hilo de 1 px y franja de 14 px (la mitad de 2 y 28) y tonos fríos de baja saturación
    expect(src).toContain("const LINE_PX = 1")
  })
  it("el haz sigue en el panel «Mi CV» (con su vuelta y densidad por defecto) y ya no está en la pantalla inicial", () => {
    expect(readFileSync(path.join(__dirname, "..", "components/jobs/search-profile-panel.tsx"), "utf8")).toContain("<CvDropOverlay")
    expect(readFileSync(path.join(__dirname, "..", "components/jobs/search-profile-panel.tsx"), "utf8")).not.toContain("beam={{")
    expect(readFileSync(path.join(__dirname, "..", "components/wizard/entry-screen.tsx"), "utf8")).not.toContain("beam={{")
  })
})
