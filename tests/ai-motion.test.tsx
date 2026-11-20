import { MATRIX_PATTERNS, patternForStep, patternOrder } from "@/components/ai/matrix-loader"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { AiStage } from "@/components/ai/ai-stage"
import { ThinkingTicker } from "@/components/ai/thinking-ticker"
import { MOTION } from "@/lib/motion"

const root = path.join(__dirname, "..")
const read = (f: string) => readFileSync(path.join(root, f), "utf8")
/** Quita comentarios para no confundirlos con código. */
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "")
const aiFiles = readdirSync(path.join(root, "components/ai")).filter((f) => f.endsWith(".tsx")).map((f) => `components/ai/${f}`)

describe("ThinkingTicker", () => {
  const msgs = ["Leyendo tu CV", "Estructurando", "Listo"]
  it("muestra el mensaje del paso real", () => {
    expect(renderToStaticMarkup(<ThinkingTicker messages={msgs} step={1} />)).toContain("Estructurando")
  })
  it("limita el paso al rango de mensajes", () => {
    expect(renderToStaticMarkup(<ThinkingTicker messages={msgs} step={99} />)).toContain("Listo")
    expect(renderToStaticMarkup(<ThinkingTicker messages={msgs} step={-3} />)).toContain("Leyendo tu CV")
  })
  it("anuncia los cambios a lectores de pantalla (status + aria-live polite)", () => {
    const html = renderToStaticMarkup(<ThinkingTicker messages={msgs} step={0} />)
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
  })
})

describe("AiStage", () => {
  it("trabajando: matriz de puntos, mensaje, Cancelar y contenido inerte", () => {
    const html = renderToStaticMarkup(
      <AiStage working messages={["Leyendo la oferta"]} step={0} onCancel={() => {}}>
        <p>contenido</p>
      </AiStage>,
    )
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain("data-pattern=")
    expect(html).toContain("Leyendo la oferta")
    expect(html).toContain("Cancelar")
    expect(html).toContain("inert")
    expect(html).toContain("contenido")
  })
  it("en reposo: sin overlay, sin matriz y sin aura", () => {
    const html = renderToStaticMarkup(
      <AiStage working={false} messages={["x"]} step={0}>
        <p>contenido</p>
      </AiStage>,
    )
    expect(html).toContain('aria-busy="false"')
    expect(html).not.toContain("data-pattern=")
    expect(html).not.toContain("data-ai-aura")
  })
})

describe("reglas de movimiento (docs/DESIGN-PATTERNS.md §5)", () => {
  const motionFiles = [...aiFiles, "lib/motion.ts"]

  it("no hay bordes ni giros animados: sin rotate ni conic-gradient en el movimiento", () => {
    for (const f of aiFiles) expect(code(read(f)), f).not.toMatch(/rotate|conic-gradient|mask/)
  })
  it("nunca se escala: ni `scale` en el código de movimiento ni en las clases de la UI", () => {
    for (const f of motionFiles) expect(code(read(f)), f).not.toMatch(/\bscale\b|\bscale[XY]?\s*:|\bscale-\d|scale\(/)
    const ui = ["components/steps", "components/wizard", "components/history"].flatMap((d) =>
      readdirSync(path.join(root, d)).filter((f) => f.endsWith(".tsx")).map((f) => `${d}/${f}`),
    )
    for (const f of ui) expect(code(read(f)), f).not.toMatch(/\bscale-|hover:scale|active:scale/)
  })
  it("solo se animan opacity, blur (filter) y translate (x, y)", () => {
    for (const f of aiFiles) {
      const animated = [...code(read(f)).matchAll(/\b(?:initial|animate|exit)=\{\{([^}]*)\}\}/g)].flatMap((m) => [...m[1].matchAll(/\b(\w+)\s*:/g)].map((k) => k[1]))
      for (const k of animated) expect(["opacity", "x", "y", "filter", "transition"], `${f}: ${k}`).toContain(k)
    }
  })
  it("la matriz de puntos: 16 puntos, 4 patrones distintos que siguen el paso, y respeta movimiento reducido", () => {
    expect(read("components/ai/matrix-loader.tsx")).toContain("useReducedMotion")
    const orders = MATRIX_PATTERNS.map((p) => Array.from({ length: 16 }, (_, i) => patternOrder(p, Math.floor(i / 4), i % 4)).join(","))
    expect(new Set(orders).size).toBe(4)
    expect(new Set(MATRIX_PATTERNS.map((_, i) => patternForStep(i))).size).toBe(4)
    expect(patternForStep(4)).toBe(patternForStep(0))
    // la espiral visita cada celda una sola vez
    expect(new Set(orders[3].split(",")).size).toBe(16)
  })
  it("respeta prefers-reduced-motion en el aura, el ticker y la transición de pasos", () => {
    expect(read("components/ai/ai-aura.tsx")).toContain("useReducedMotion")
    expect(read("components/ai/step-transition.tsx")).toContain("useReducedMotion")
    expect(read("components/ai/thinking-ticker.tsx")).toContain("useReducedMotion")
  })
  it("misma duración y easing en todas las pantallas: solo desde lib/motion.ts", () => {
    for (const f of aiFiles) {
      const c = code(read(f))
      expect(c, f).not.toMatch(/duration:\s*\d/)
      expect(c, f).not.toMatch(/ease:\s*\[/)
    }
    expect(MOTION.enter).toBeGreaterThan(MOTION.exit) // las entradas son más lentas que las salidas
  })
  it("AiAura solo usa variables del tema para el color (sin hex ni rgb)", () => {
    const c = code(read("components/ai/ai-aura.tsx"))
    expect(c).not.toMatch(/(?<![&\w])#[0-9a-fA-F]{6}\b|rgba?\(|hsl\(/)
    expect(c).toContain("var(--primary)")
  })
})
