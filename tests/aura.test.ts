import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { AURA, AURA_PALETTE, auraHit } from "@/lib/aura/aura"
import { AURA_FRAGMENT } from "@/lib/aura/aura-shader"
import { oklchToRgb } from "@/lib/aura/color"
import { EFFECT_COLORS } from "@/lib/design-tokens"

const read = (p: string) => readFileSync(path.join(__dirname, "..", p), "utf8")
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")

describe("aura de la pantalla inicial", () => {
  it("convierte OKLCH a sRGB: blanco, negro y los tonos fríos del haz", () => {
    expect(oklchToRgb("oklch(1 0 0)").map((v) => +v.toFixed(2))).toEqual([1, 1, 1])
    expect(oklchToRgb("oklch(0 0 0)").map((v) => +v.toFixed(2))).toEqual([0, 0, 0])
    const [r, g, b] = oklchToRgb(EFFECT_COLORS["flow-blue"]) // azul frío: más azul que rojo
    expect(b).toBeGreaterThan(r)
    expect(b).toBeGreaterThan(g * 0.95)
    for (const v of [r, g, b]) expect(v).toBeGreaterThan(0.3) // claro (L = 0,7)
    expect(() => oklchToRgb("red")).toThrow()
  })
  it("la paleta sale de los tokens documentados `flow-*` (ningún color suelto)", () => {
    expect(AURA_PALETTE).toHaveLength(5)
    for (const c of AURA_PALETTE) expect(Object.values(EFFECT_COLORS)).toContain(c)
    expect(code(read("lib/aura/aura.ts"))).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgb\(|hsl\(/)
  })
  it("GOLPE: arranca al máximo (fuerte, con el halo hinchado) y se calma de forma exponencial; la onda de luz avanza hasta apagarse", () => {
    const start = auraHit(0)
    expect(start.hit).toBeCloseTo(AURA.hit, 6)
    expect(start.swell).toBeCloseTo(AURA.swell, 6)
    expect(start.shock).toBe(0)
    expect(auraHit(AURA.hitDecayS).hit).toBeCloseTo(AURA.hit / Math.E, 6)
    expect(auraHit(5 * AURA.hitDecayS).hit).toBeLessThan(AURA.hit * 0.01) // después, calma
    for (let t = 0.1; t < 5; t += 0.1) expect(auraHit(t).hit).toBeLessThan(auraHit(t - 0.1).hit)
    expect(auraHit(AURA.shockS).shock).toBeCloseTo(1, 6) // llega al borde
    expect(auraHit(-1).hit).toBe(AURA.hit) // antes del primer cuadro: sin saltos
  })
  it("el golpe es mucho más fuerte que los pulsos de la calma, que se repiten en bucle", () => {
    expect(AURA.pulseAmp).toBeLessThan(AURA.hit / 2)
    expect(AURA.pulseEveryS).toBeGreaterThan(AURA.shockS) // un pulso no pisa al anterior
    expect(AURA.pulseStartS).toBeGreaterThan(AURA.shockS / 2)
    expect(AURA_FRAGMENT).toContain("fract(p)") // los pulsos se repiten
    expect(code(AURA_FRAGMENT)).toContain("shockRing(r, uShock, uShockWidth) * uHit") // el golpe va una sola vez
  })
  it("el mensaje central se lee: el centro del halo se atenúa y el brillo en calma es moderado", () => {
    expect(AURA.hole).toBeGreaterThanOrEqual(0.4)
    expect(AURA.intensity).toBeLessThan(0.8)
    expect(AURA_FRAGMENT).toContain("smoothstep(0.0, R * 0.95, r)")
  })
  it("es luz fluida y orgánica: ruido que mueve el radio y mezcla el color, respiración, paleta cíclica", () => {
    for (const k of ["fbm", "uWarp", "uBreathHz", "palette(", "lobes"]) expect(AURA_FRAGMENT).toContain(k)
    expect(AURA.warp).toBeGreaterThan(0)
    expect(AURA.breathHz).toBeLessThan(0.6) // respira despacio
  })
  it("solo SUMA luz: lienzo transparente con alfa premultiplicado; no samplea ninguna imagen ni deforma ni desenfoca", () => {
    const c = code(AURA_FRAGMENT)
    expect(c).not.toMatch(/sampler2D|texture2D|uTexture|blur|uBulge|uCurve|uCenter|uSpec/i)
    expect(c).toContain("gl_FragColor = vec4(min(rgb, vec3(1.0)), a)")
    const run = read("lib/aura/aura.ts")
    expect(run).toContain("alpha: true")
    expect(run).toContain("premultipliedAlpha: true")
  })
  it("el lienzo entra rápido (el golpe no queda tapado por el fundido), es decorativo y no corre con la pestaña oculta", () => {
    expect(AURA.fadeInMs).toBeLessThanOrEqual(150)
    const run = read("lib/aura/aura.ts")
    expect(run).toContain("duration-150")
    expect(run).toContain("aria-hidden")
    expect(run).toContain("document.hidden")
    expect(run).toContain("loseContext")
    expect(run).toContain("if (t0 < 0) t0 = now") // el reloj del golpe arranca en el primer cuadro dibujado
  })
  it("con «reducir movimiento» no se pinta nada y el módulo se precarga para que el golpe no espere", () => {
    const comp = read("components/magic/aura-field.tsx")
    expect(comp).toContain("useReducedMotion")
    expect(comp).toContain("reduce")
    expect(comp).toMatch(/precarga|Precarga/)
  })
  it("el LOGIN no cambia y no quedan restos de las ondas ni del barrido de lupa", () => {
    for (const f of ["components/auth/login-lens.tsx", "lib/lens/run.ts", "lib/lens/shaders.ts", "lib/lens/frame.ts", "lib/lens/rasterize.ts"]) expect(read(f), f).not.toMatch(/aura|Aura|ripple|Ripple|sweep|Sweep/i)
    for (const f of ["lib/aura/aura.ts", "lib/aura/aura-shader.ts", "components/magic/aura-field.tsx", "components/wizard/entry-screen.tsx"]) expect(code(read(f)), f).not.toMatch(/ripple|Ripple|RIPPLE|sweep|Sweep|SWEEP/)
  })
})
