"use client"

import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { MOTION, TRANSITION_IN, TRANSITION_OUT } from "@/lib/motion"

/**
 * Muestra u oculta su contenido con movimiento + desenfoque: aparece subiendo desde abajo mientras pasa de borroso a nítido y, al ocultarse,
 * se difumina hacia abajo. Misma curva y duraciones que el resto de la app (`lib/motion`). Con «reducir movimiento» aparece y desaparece sin animar.
 */
export function BlurReveal({ show, className, children }: { show: boolean; className?: string; children: ReactNode }) {
  const reduce = useReducedMotion()
  if (reduce) return show ? <div className={className}>{children}</div> : null
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={className}
          initial={{ opacity: 0, y: MOTION.offset, filter: `blur(${MOTION.blur}px)` }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: TRANSITION_IN }}
          exit={{ opacity: 0, y: MOTION.offset, filter: `blur(${MOTION.blur}px)`, transition: TRANSITION_OUT }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
