"use client"

import { motion, useReducedMotion } from "motion/react"
import { MOTION } from "@/lib/motion"

/**
 * DotLoader — el «Matrix dot loader» de transitions.dev (P33), con sus medidas exactas: cuadrícula de 4×4 puntos de 2 px con 2 px de separación
 * (14 px en total). Cada punto pulsa de su color base al activo en un ciclo compartido de 1,2 s (activo al 15 % del ciclo, de vuelta al 45 %)
 * con un retardo propio; cuatro caracteres de movimiento: `scan` (barrido por columnas), `twinkle` (destellos al azar), `orbit` (órbita por el
 * perímetro con el centro quieto) y `pulse` (el centro y luego el borde). `rounded` quita las cuatro esquinas.
 * Fuente: https://transitions.dev/detail.html?t=matrix-dot-loader (la propia página invita a copiar su CSS/JS). El color pulsa con opacidad sobre el
 * color del texto del tema, así que sirve en claro y oscuro. Con «reducir movimiento» queda quieto. Es decorativo (`aria-hidden`).
 */
export const DOT_VARIANTS = ["scan", "twinkle", "orbit", "pulse"] as const
export type DotVariant = (typeof DOT_VARIANTS)[number]

const CORNERS = [0, 3, 12, 15]
/** Perímetro sin esquinas, en sentido horario, y las 4 celdas del centro. */
const RING = [1, 2, 7, 11, 14, 13, 8, 4]
const INNER = [5, 6, 9, 10]
const TWINKLE = [7, 2, 11, 5, 14, 9, 0, 12, 3, 15, 6, 10, 13, 1, 8, 4]

/** Retardo (ms) de la celda `idx` según el carácter de movimiento; `null` = esa celda no anima (queda en su color base). Cálculo idéntico al de la página de referencia. */
export function dotDelay(variant: DotVariant, idx: number, cycleMs = MOTION.loaderCycle * 1000): number | null {
  switch (variant) {
    case "scan":
      return Math.round((idx % 4) * (cycleMs / 10))
    case "twinkle":
      return Math.round(TWINKLE[idx] * (cycleMs / 16))
    case "orbit": {
      const k = RING.indexOf(idx)
      return k === -1 ? null : Math.round(k * (cycleMs / 8))
    }
    case "pulse":
      return Math.round((INNER.includes(idx) ? 0 : 1) * (cycleMs * 0.16))
  }
}

export function DotLoader({ variant = "twinkle", rounded = false, className }: { variant?: DotVariant; rounded?: boolean; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <div aria-hidden data-variant={variant} data-rounded={rounded} className={`grid size-3.5 grid-cols-4 gap-0.5 text-foreground ${className ?? ""}`}>
      {Array.from({ length: 16 }, (_, idx) => {
        if (rounded && CORNERS.includes(idx)) return <span key={idx} className="invisible size-0.5" />
        const delay = dotDelay(variant, idx)
        return (
          <motion.span
            key={idx}
            className="size-0.5 bg-current"
            initial={{ opacity: MOTION.loaderBase }}
            animate={reduce || delay === null ? undefined : { opacity: [MOTION.loaderBase, MOTION.loaderActive, MOTION.loaderBase, MOTION.loaderBase] }}
            transition={{ duration: MOTION.loaderCycle, times: [0, 0.15, 0.45, 1], ease: "easeInOut", repeat: Infinity, delay: (delay ?? 0) / 1000 }}
          />
        )
      })}
    </div>
  )
}
