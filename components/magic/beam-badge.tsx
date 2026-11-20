"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"
import { EFFECT_COLORS } from "@/lib/design-tokens"
import { MOTION } from "@/lib/motion"

/** Relleno horizontal del distintivo (px-4 = 16 px por lado): sirve para fijar su ancho a lo que mide el contenido. */
const CHROME = 2 * 16
/** Alto del distintivo: py-2 (2 × 8 px) + la línea de `text-xs` (16 px). */
const HEIGHT = 32
/** Diámetro de cada luz y vuelta completa por el contorno, en segundos. */
const LIGHT_SIZE = 30
const LAP = 6
const STEPS = 48

/**
 * Posiciones (x, y) a lo largo del contorno de una píldora de `w × h`, a velocidad constante: borde de arriba de izquierda a derecha, semicírculo
 * derecho, borde de abajo de derecha a izquierda y semicírculo izquierdo. `phase` (0–1) desplaza el punto de partida dentro de la vuelta.
 */
export function stadiumPath(w: number, h: number, steps: number, phase = 0): { x: number; y: number }[] {
  const r = h / 2
  const L = Math.max(0, w - h)
  const arc = Math.PI * r
  const P = 2 * L + 2 * arc
  const at = (dist: number) => {
    let d = dist
    if (d < L) return { x: r + d, y: 0 }
    d -= L
    if (d < arc) {
      const a = -Math.PI / 2 + d / r
      return { x: r + L + r * Math.cos(a), y: r + r * Math.sin(a) }
    }
    d -= arc
    if (d < L) return { x: r + L - d, y: h }
    d -= L
    const a = Math.PI / 2 + d / r
    return { x: r + r * Math.cos(a), y: r + r * Math.sin(a) }
  }
  return Array.from({ length: steps + 1 }, (_, i) => at((((i / steps) + phase) % 1) * P))
}

/** Una luz suave que viaja por el contorno; el padre la recorta (`overflow-hidden`), así solo se ve la mitad de adentro: luz que recorre el borde por dentro. */
function Light({ color, w, phase, reduce }: { color: string; w: number; phase: number; reduce: boolean }) {
  const pts = useMemo(() => stadiumPath(w, HEIGHT, STEPS, phase), [w, phase])
  return (
    <motion.span
      aria-hidden
      className="absolute top-0 left-0"
      style={{ width: LIGHT_SIZE, height: LIGHT_SIZE, marginLeft: -LIGHT_SIZE / 2, marginTop: -LIGHT_SIZE / 2, background: `radial-gradient(closest-side, color-mix(in oklab, ${color} 75%, transparent), transparent)` }}
      initial={{ x: pts[0].x, y: pts[0].y }}
      animate={reduce ? undefined : { x: pts.map((p) => p.x), y: pts.map((p) => p.y) }}
      transition={{ duration: LAP, ease: "linear", repeat: Infinity, times: pts.map((_, i) => i / STEPS) }}
    />
  )
}

/**
 * Distintivo de fondo SÓLIDO y ligeramente distinto al de la app (`card`), SIN borde, con **dos luces** (azul hielo y lila pálido, `EFFECT_COLORS`) que
 * recorren el contorno de la píldora **por dentro** a velocidad constante (una vuelta cada 6 s), desfasadas media vuelta: no giran desde el centro, siguen
 * el borde (arriba, el extremo derecho, abajo, el extremo izquierdo). El ancho se anima (300 ms, la curva de la app) cuando el contenido cambia de largo.
 * Con «reducir movimiento» las luces quedan quietas. Decorativo: no recibe clics.
 */
export function BeamBadge({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = !!useReducedMotion()
  const content = useRef<HTMLSpanElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    const el = content.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.ceil(entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const total = width === null ? null : width + CHROME
  return (
    <div
      className={`relative flex justify-center overflow-hidden rounded-full bg-card px-4 py-2 text-xs ${className ?? ""}`}
      style={{ width: total ?? undefined, transition: reduce ? undefined : `width 300ms cubic-bezier(${MOTION.ease.join(",")})` }}
    >
      {total !== null && (
        <>
          <Light key={`ice-${total}`} color={EFFECT_COLORS["beam-ice"]} w={total} phase={0} reduce={reduce} />
          <Light key={`lilac-${total}`} color={EFFECT_COLORS["beam-lilac"]} w={total} phase={0.5} reduce={reduce} />
        </>
      )}
      <span ref={content} className="relative inline-flex shrink-0">
        {children}
      </span>
    </div>
  )
}
