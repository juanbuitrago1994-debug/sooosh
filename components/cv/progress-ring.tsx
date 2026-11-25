"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { MOTION, TRANSITION_IN, TRANSITION_OUT } from "@/lib/motion"

/**
 * Anillo de avance: como el spinner de la app (mismo tamaño y trazo), pero NO gira solo: el arco se llena a medida que la persona avanza (`percent`),
 * con el nombre de la etapa y el porcentaje al lado. El nombre cambia con desenfoque + desplazamiento (solo opacity, blur y translate); con «reducir
 * movimiento» el arco salta sin animar. `role="progressbar"` con el valor.
 */
export function ProgressRing({ percent, label, className }: { percent: number; /** nombre de la etapa en curso */ label: string; className?: string }) {
  const reduce = useReducedMotion()
  const value = Math.min(100, Math.max(0, percent))
  return (
    <div role="progressbar" aria-label={`Avance de la validación: ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className={`flex items-center gap-2 text-sm text-muted-foreground ${className ?? ""}`}>
      <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0 -rotate-90 fill-none stroke-2">
        <circle cx="12" cy="12" r="10" className="stroke-muted-foreground/30" />
        <motion.circle cx="12" cy="12" r="10" strokeLinecap="round" className="stroke-foreground" initial={false} animate={{ pathLength: value / 100 }} transition={reduce ? { duration: 0 } : { duration: MOTION.enter, ease: MOTION.ease }} />
      </svg>
      <span className="relative flex h-6 items-center">
        {reduce ? (
          <span>{label}</span>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={label} className="whitespace-nowrap" initial={{ opacity: 0, y: MOTION.offset, filter: `blur(${MOTION.blur}px)` }} animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: TRANSITION_IN }} exit={{ opacity: 0, y: -MOTION.offset, filter: `blur(${MOTION.blur}px)`, transition: TRANSITION_OUT }}>
              {label}
            </motion.span>
          </AnimatePresence>
        )}
      </span>
      <span className="tabular-nums">{value} %</span>
    </div>
  )
}
