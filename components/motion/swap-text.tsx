"use client"

import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { MOTION, TRANSITION_IN, TRANSITION_OUT } from "@/lib/motion"

/**
 * Cambia un texto (o un trozo de interfaz) por otro con desenfoque + desplazamiento vertical suave: el anterior sale hacia arriba y se desenfoca, el
 * nuevo entra desde abajo ya nítido. Solo opacity, blur y translate (docs/DESIGN-PATTERNS.md §5). `id` identifica el contenido: cuando cambia, se anima.
 * Con «reducir movimiento» el cambio es directo. El contenedor reserva el alto de una línea para que nada salte mientras uno entra y otro sale.
 */
export function SwapText({ id, children, className, blur = true }: { id: string | number; children: ReactNode; className?: string; /** con desenfoque (por defecto) o solo opacidad + desplazamiento */ blur?: boolean }) {
  const reduce = useReducedMotion()
  if (reduce) return <span className={className}>{children}</span>
  return (
    <span className={`relative inline-flex max-w-full ${className ?? ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={id}
          className="inline-flex max-w-full"
          initial={blur ? { opacity: 0, y: MOTION.offset, filter: `blur(${MOTION.blur}px)` } : { opacity: 0, y: MOTION.offset }}
          animate={blur ? { opacity: 1, y: 0, filter: "blur(0px)", transition: TRANSITION_IN } : { opacity: 1, y: 0, transition: TRANSITION_IN }}
          exit={blur ? { opacity: 0, y: -MOTION.offset, filter: `blur(${MOTION.blur}px)`, transition: TRANSITION_OUT } : { opacity: 0, y: -MOTION.offset, transition: TRANSITION_OUT }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
