"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { useReducedMotion } from "motion/react"
import { EFFECT_COLORS } from "@/lib/design-tokens"

/**
 * FlowBeam — haz de luz de varios colores que recorre el borde de un panel o de la ventana (pedido por Juan el 23 y el 24-nov-2026), con la
 * paleta de la variante `colorful` de `border-beam` (MIT, https://libraries.dev/beam).
 *
 * FLUIDEZ (por qué está hecho así): la versión anterior animaba una variable CSS (`--fb-angle`) que alimentaba máscaras y gradientes; eso obliga al
 * navegador a repintar en el hilo principal en CADA fotograma y, en una ventana completa, perdía fotogramas (se veía con retraso). Ahora lo único
 * que se anima es un `transform: rotate()` de una capa ya pintada (lo hace la GPU, sin repintar) y las máscaras son ESTÁTICAS: una franja de ancho
 * fijo pegada al borde (resplandor) y un anillo de 1 px (hilo). Un arco largo con los colores repartidos a lo largo de él gira bajo esas máscaras, así
 * que se ve la luz recorriendo el borde y cambiando de color. Sin `filter: blur` (caro y no hace falta: el degradado y la franja ya difuminan).
 * La capa que gira es un cuadrado del tamaño de la DIAGONAL del contenedor (lo justo para cubrir las esquinas en cualquier ángulo).
 * Con «reducir movimiento» no gira: queda un resplandor interior quieto. Decorativo; el radio de esquina se hereda del contenedor.
 * `lap`: segundos por vuelta (5 en el panel). `density`: 1 = el del panel; más = más ancho y con más luz.
 */
const LAP = 5
const C = EFFECT_COLORS
const clamp1 = (n: number) => Math.min(1, n)
const tint = (color: string, pct: number) => `color-mix(in oklab, ${color} ${pct}%, transparent)`

/**
 * Aspecto del haz (el que Juan aprobó con la versión de máscara animada, 24-nov-2026): una ventana de luz de ≈ 65 % del contorno con el mismo perfil de
 * intensidad (nace despacio, núcleo pleno en el centro, se apaga al final) y los colores de la paleta repartidos a lo largo de ella, en el mismo
 * orden que el anillo de color de entonces: naranja → rosa → magenta → violeta → azul → turquesa → verde. Ahora los colores y la intensidad van
 * dentro de UN degradado cónico que gira (transform), así que se ve igual pero sin repintar nada en cada fotograma.
 */
const PALETTE = [C["flow-orange"], C["flow-pink"], C["flow-magenta"], C["flow-violet"], C["flow-blue"], C["flow-teal"], C["flow-green"]]
const CORE = `color-mix(in oklab, ${C["flow-gray"]} 100%, white)`
const START = 108 // grados: donde nace la luz (30 % del giro)
const END = 342 // grados: donde se apaga (95 %)
// Perfil de intensidad de la ventana (los mismos puntos de la máscara de la versión anterior).
const PROFILE: [number, number][] = [[108, 0], [129.6, 0.1], [158.4, 0.35], [187.2, 1], [288, 1], [309.6, 0.35], [331.2, 0.1], [342, 0]]
const profileAt = (deg: number) => {
  for (let i = 1; i < PROFILE.length; i++) {
    const [d0, a0] = PROFILE[i - 1]
    const [d1, a1] = PROFILE[i]
    if (deg <= d1) return a0 + ((a1 - a0) * (deg - d0)) / (d1 - d0)
  }
  return 0
}
/** Color de la paleta a lo largo de la ventana, mezclando los dos vecinos. */
const colorAt = (deg: number) => {
  const f = ((deg - START) / (END - START)) * (PALETTE.length - 1)
  const i = Math.min(PALETTE.length - 2, Math.floor(f))
  return `color-mix(in oklab, ${PALETTE[i + 1]} ${Math.round((f - i) * 100)}%, ${PALETTE[i]})`
}
/** `alpha`: intensidad de los colores; `whiten`: cuánto se aclara el centro (el hilo lleva un núcleo claro, como el original). */
const arc = (alpha: number, whiten: number) => {
  const st: string[] = ["transparent 0deg", `transparent ${START}deg`]
  for (let d = START + 6; d <= END; d += 6) {
    const a = profileAt(d)
    const core = Math.round(whiten * a * 100)
    const color = core > 0 ? `color-mix(in oklab, ${CORE} ${core}%, ${colorAt(d)})` : colorAt(d)
    st.push(`color-mix(in oklab, ${color} ${Math.round(clamp1(alpha * a) * 100)}%, transparent) ${d}deg`)
  }
  st.push("transparent 360deg")
  return `conic-gradient(in oklab from 0deg, ${st.join(", ")})`
}
const GLOW = (d: number) => arc(0.45 * d, 0)
const LINE = (d: number) => arc(1, 0.3 * d)

const band = (w: number) => `linear-gradient(white, transparent ${w}px, transparent calc(100% - ${w}px), white), linear-gradient(to right, white, transparent ${w}px, transparent calc(100% - ${w}px), white)`
/** Anillo de 1 px: va con la propiedad `mask` (atajo), porque `content-box` es un valor de caja y NO es válido dentro de `mask-image`: el navegador descartaba toda la declaración y la capa quedaba sin máscara. */
const RING = "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)"

export function FlowBeam({ className, lap = LAP, density = 1 }: { className?: string; /** segundos por vuelta */ lap?: number; /** 1 = el del panel; más = más denso */ density?: number }) {
  const reduce = useReducedMotion()
  const box = useRef<HTMLDivElement>(null)
  const [side, setSide] = useState(0)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setSide(Math.ceil(Math.hypot(el.clientWidth, el.clientHeight)) + 2)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (reduce) {
    return <span aria-hidden className={`pointer-events-none absolute inset-0 ${className ?? ""}`} style={{ boxShadow: `inset 0 0 18px 2px ${tint(C["flow-blue"], 35)}` }} />
  }
  const arm = { position: "absolute", left: "50%", top: "50%", width: side, height: side, marginLeft: -side / 2, marginTop: -side / 2, willChange: "transform" } as const
  const w = 28 // ancho fijo de la franja del resplandor (el de la versión anterior); la densidad solo sube la intensidad
  return (
    <div ref={box} aria-hidden data-flow-beam className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`} style={{ borderRadius: "inherit" }}>
      <style>{`@keyframes fb-turn { to { transform: rotate(360deg); } } [data-flow-beam] [data-fb-arm] { animation: fb-turn ${lap}s linear infinite; }`}</style>
      {side > 0 && (
        <>
          {/* resplandor: franja de ancho fijo pegada al borde; la luz que gira debajo solo se ve ahí */}
          <div className="absolute inset-0" style={{ maskImage: band(w), WebkitMaskImage: band(w), maskComposite: "add", WebkitMaskComposite: "source-over" }}>
            <span data-fb-arm style={{ ...arm, background: GLOW(density), opacity: 1 }} />
          </div>
          {/* hilo nítido de 1 px sobre el borde */}
          <div className="absolute inset-0 p-px" style={{ WebkitMask: RING, mask: RING, WebkitMaskComposite: "xor", maskComposite: "exclude" }}>
            <span data-fb-arm style={{ ...arm, background: LINE(density), opacity: 1 }} />
          </div>
        </>
      )}
    </div>
  )
}
