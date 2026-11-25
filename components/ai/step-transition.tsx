"use client"

import type { ReactNode } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { MOTION, TRANSITION_IN, TRANSITION_OUT } from "@/lib/motion"

/** Transición fluida entre pasos: la pantalla saliente sube y se desenfoca; la entrante sube desde abajo y se aclara. */
export function StepTransition({ id, children, className }: { id: string | number; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  const y = reduce ? 0 : MOTION.offset
  const blur = reduce ? 0 : MOTION.blur
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        className={className}
        initial={{ opacity: 0, y, filter: `blur(${blur}px)` }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: TRANSITION_IN }}
        exit={{ opacity: 0, y: -y, filter: `blur(${blur}px)`, transition: TRANSITION_OUT }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
