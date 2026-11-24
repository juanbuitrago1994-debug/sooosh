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
 * orden de la ventana: pizarra → gris → azul → cielo → hielo → gris → azul (tonos fríos, azules y grises; antes era de varios colores). Ahora los colores y la intensidad van
 * dentro de UN degradado cónico que gira (transform), así que se ve igual pero sin repintar nada en cada fotograma.
 */
const PALETTE = [C["flow-slate"], C["flow-gray"], C["flow-blue"], C["flow-sky"], C["flow-ice"], C["flow-gray"], C["flow-blue"]]
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

/**
 * Máscaras ESTÁTICAS que siguen el contorno redondeado (SVG como imagen de máscara; se pintan una sola vez por tamaño). Las de antes eran rectángulos: la
 * franja se armaba con dos degradados rectos que se SUMABAN, así que en las esquinas había el doble de luz y ángulos rectos aunque el contorno es redondeado, y
 * el hilo de 1 px (máscara de rectángulo) se cortaba en la curva. Ahora la franja es un trazo difuminado del rectángulo redondeado (cae parejo hacia adentro,
 * también en las curvas) y el hilo es un trazo de 1,5 px del mismo rectángulo.
 */
type Box = { w: number; h: number; r: number }
const svgMask = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
const glowMask = ({ w, h, r }: Box, band: number) =>
  svgMask(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><filter id="b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${(band * 0.38).toFixed(1)}"/></filter></defs><rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="none" stroke="white" stroke-width="${(band * 0.9).toFixed(1)}" filter="url(#b)"/></svg>`)
const lineMask = ({ w, h, r }: Box) => svgMask(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${Math.max(0, r - 0.75)}" fill="none" stroke="white" stroke-width="1.5"/></svg>`)
const maskStyle = (img: string) => ({ WebkitMaskImage: img, maskImage: img, WebkitMaskSize: "100% 100%", maskSize: "100% 100%", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat" }) as const

export function FlowBeam({ className, lap = LAP, density = 1 }: { className?: string; /** segundos por vuelta */ lap?: number; /** 1 = el del panel; más = más denso */ density?: number }) {
  const reduce = useReducedMotion()
  const box = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState<Box | null>(null)

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setDims({ w: el.clientWidth, h: el.clientHeight, r: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (reduce) {
    return <span aria-hidden className={`pointer-events-none absolute inset-0 ${className ?? ""}`} style={{ boxShadow: `inset 0 0 18px 2px ${tint(C["flow-blue"], 35)}` }} />
  }
  const side = dims ? Math.ceil(Math.hypot(dims.w, dims.h)) + 2 : 0
  const arm = { position: "absolute", left: "50%", top: "50%", width: side, height: side, marginLeft: -side / 2, marginTop: -side / 2, willChange: "transform" } as const
  const band = 28 // ancho fijo de la franja del resplandor (el de la versión anterior); la densidad solo sube la intensidad
  return (
    <div ref={box} aria-hidden data-flow-beam className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`} style={{ borderRadius: "inherit" }}>
      <style>{`@keyframes fb-turn { to { transform: rotate(360deg); } } [data-flow-beam] [data-fb-arm] { animation: fb-turn ${lap}s linear infinite; }`}</style>
      {dims && dims.w > 0 && dims.h > 0 && (
        <>
          {/* resplandor: franja de ancho fijo pegada al borde; la luz que gira debajo solo se ve ahí */}
          <div className="absolute inset-0" style={maskStyle(glowMask(dims, band))}>
            <span data-fb-arm style={{ ...arm, background: GLOW(density), opacity: 1 }} />
          </div>
          {/* hilo nítido de 1 px sobre el borde */}
          <div className="absolute inset-0" style={maskStyle(lineMask(dims))}>
            <span data-fb-arm style={{ ...arm, background: LINE(density), opacity: 1 }} />
          </div>
        </>
      )}
    </div>
  )
}
