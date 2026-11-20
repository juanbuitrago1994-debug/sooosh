"use client"

import { motion } from "motion/react"
import { MOTION } from "@/lib/motion"
import { STEPS } from "@/lib/steps"

/**
 * Indicador mínimo de pasos: segmentos que se llenan con un resorte suave (solo translate).
 * No es una barra de carga: marca en qué paso estás.
 */
export function StepDots({ current }: { current: number }) {
  return (
    <ol aria-label={`Paso ${current + 1} de ${STEPS.length}: ${STEPS[current].label}`} className="flex gap-1.5">
      {STEPS.map((s, i) => (
        <li key={s.id} aria-current={i === current ? "step" : undefined} className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
          <motion.span aria-hidden className="block h-full w-full rounded-full bg-primary" initial={false} animate={{ x: i <= current ? "0%" : "-100%" }} transition={MOTION.spring} />
          <span className="sr-only">{s.label}</span>
        </li>
      ))}
    </ol>
  )
}
