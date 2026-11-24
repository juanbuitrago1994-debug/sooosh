"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { FlowBeam } from "@/components/magic/flow-beam"
import { MOTION, TRANSITION_IN, TRANSITION_OUT } from "@/lib/motion"

/**
 * Capa que aparece mientras se arrastra un CV encima o se está leyendo: el haz `FlowBeam` recorre todo su borde y el mensaje queda centrado en
 * vertical y horizontal. La usan el panel «Mi CV» (cubre el panel) y la pantalla inicial (cubre la ventana, con `className="fixed inset-2"`), para que
 * el efecto sea el mismo. Entra y sale con opacity y blur. El haz solo aparece aquí (ver CLAUDE.md).
 */
export function CvDropOverlay({ show, className = "absolute inset-0", hidden = false, children }: { show: boolean; className?: string; /** `aria-hidden` (p. ej. cuando solo es decorativo, al arrastrar) */ hidden?: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          data-drop-overlay
          aria-hidden={hidden}
          className={`pointer-events-none rounded-2xl ${className}`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, filter: `blur(${MOTION.blur}px)` }}
          animate={{ opacity: 1, filter: "blur(0px)", transition: TRANSITION_IN }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, filter: `blur(${MOTION.blur}px)`, transition: TRANSITION_OUT }}
        >
          <FlowBeam className="rounded-2xl" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
