"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"
import { MOTION } from "@/lib/motion"

/** Relleno horizontal del distintivo (px-4 = 16 px por lado): sirve para fijar su ancho a lo que mide el contenido. */
const CHROME = 2 * 16
/** Ciclo del destello (s): cruza el distintivo en el último 28 % y descansa el resto. Ancho de la banda y margen para que entre y salga por completo. */
const CYCLE = 4.2
const SWEEP_SHARE = 0.28
const BAND = 34
const MARGIN = 48

/** Una banda de luz suave, de un solo color: el principal del tema (blanco en oscuro) con los bordes desvaneciéndose. */
const BAND_GRADIENT = "linear-gradient(90deg, transparent, color-mix(in oklab, var(--primary) 34%, transparent), transparent)"

/**
 * Cuadros de la animación del destello para un distintivo de ancho `w`: la banda espera fuera (a la izquierda) durante el descanso y luego cruza hasta
 * salir por la derecha. `times` reparte el ciclo: descanso hasta `1 - SWEEP_SHARE` y barrido en el resto.
 */
export function sweepFrames(w: number): { x: number[]; times: number[] } {
  return { x: [-MARGIN, -MARGIN, w + MARGIN], times: [0, 1 - SWEEP_SHARE, 1] }
}

/**
 * Distintivo de fondo SÓLIDO y ligeramente distinto al de la app (`card`), SIN borde, con un **destello diagonal**: una sola banda de luz inclinada que
 * cruza el distintivo de izquierda a derecha, como el brillo sobre un vidrio, y luego descansa unos 3 s antes de repetir. El ancho se anima (300 ms, la
 * curva de la app) cuando el contenido cambia de largo. Con «reducir movimiento» no hay destello. Decorativo: no recibe clics.
 */
export function BeamBadge({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
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
  const frames = total === null ? null : sweepFrames(total)
  return (
    <div
      className={`relative flex justify-center overflow-hidden rounded-full bg-card px-4 py-2 text-xs ${className ?? ""}`}
      style={{ width: total ?? undefined, transition: reduce ? undefined : `width 300ms cubic-bezier(${MOTION.ease.join(",")})` }}
    >
      {!reduce && frames && (
        <motion.span
          key={total}
          aria-hidden
          className="pointer-events-none absolute"
          style={{ top: -8, left: 0, width: BAND, height: 48, skewX: -22, background: BAND_GRADIENT, filter: "blur(1.5px)" }}
          initial={{ x: frames.x[0] }}
          animate={{ x: frames.x }}
          transition={{ duration: CYCLE, times: frames.times, ease: ["linear", "easeInOut"], repeat: Infinity }}
        />
      )}
      <span ref={content} className="relative inline-flex shrink-0">
        {children}
      </span>
    </div>
  )
}
