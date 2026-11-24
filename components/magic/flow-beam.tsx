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

// Colores a lo largo del arco: de la cola (turquesa) a la cabeza (naranja), como la variante `colorful` de la librería. Empieza transparente.
const stops = (from: number) =>
  `transparent 0deg, transparent ${from}deg, ${tint(C["flow-teal"], 40)} ${from + 45}deg, ${tint(C["flow-green"], 75)} ${from + 75}deg, ${tint(C["flow-blue"], 100)} ${from + 105}deg, ${tint(C["flow-violet"], 100)} ${from + 135}deg, ${tint(C["flow-magenta"], 100)} ${from + 165}deg, ${tint(C["flow-pink"], 100)} ${from + 190}deg, ${tint(C["flow-orange"], 100)} ${Math.min(from + 210, 352)}deg, transparent 360deg`
const GLOW = `conic-gradient(in oklab from 0deg, ${stops(120)})`
const LINE = `conic-gradient(in oklab from 0deg, ${stops(150)})`

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
  const w = 44 // ancho fijo de la franja del resplandor; la densidad solo sube la intensidad
  return (
    <div ref={box} aria-hidden data-flow-beam className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`} style={{ borderRadius: "inherit" }}>
      <style>{`@keyframes fb-turn { to { transform: rotate(360deg); } } [data-flow-beam] [data-fb-arm] { animation: fb-turn ${lap}s linear infinite; }`}</style>
      {side > 0 && (
        <>
          {/* resplandor: franja de ancho fijo pegada al borde; la luz que gira debajo solo se ve ahí */}
          <div className="absolute inset-0" style={{ maskImage: band(w), WebkitMaskImage: band(w), maskComposite: "add", WebkitMaskComposite: "source-over" }}>
            <span data-fb-arm style={{ ...arm, background: GLOW, opacity: clamp1(0.75 * density) }} />
          </div>
          {/* hilo nítido de 1 px sobre el borde */}
          <div className="absolute inset-0 p-px" style={{ WebkitMask: RING, mask: RING, WebkitMaskComposite: "xor", maskComposite: "exclude" }}>
            <span data-fb-arm style={{ ...arm, background: LINE, opacity: clamp1(0.9 * density) }} />
          </div>
        </>
      )}
    </div>
  )
}
