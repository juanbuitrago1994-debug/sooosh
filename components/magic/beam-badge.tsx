"use client"

import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"

/**
 * Distintivo con un haz de luz que recorre su borde muy despacio (una vuelta cada 6 s). El haz usa el color principal del tema (blanco en
 * oscuro). Con «reducir movimiento» queda solo el borde tenue. El contenedor es decorativo: no recibe clics.
 */
export function BeamBadge({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <div className={`relative inline-flex overflow-hidden rounded-full bg-border/50 p-px ${className ?? ""}`}>
      {!reduce && (
        <motion.span
          aria-hidden
          className="absolute"
          style={{ left: "50%", top: "50%", width: 480, height: 480, marginLeft: -240, marginTop: -240, background: "conic-gradient(from 0deg, transparent 0deg, transparent 290deg, var(--primary) 360deg)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 6, ease: "linear", repeat: Infinity }}
        />
      )}
      <div className="relative rounded-full bg-background/85 px-5 py-2.5 text-sm backdrop-blur-xl">{children}</div>
    </div>
  )
}
