"use client"

import { AnimatePresence, motion } from "motion/react"
import { FlowBeam } from "@/components/magic/flow-beam"
import { TRANSITION_IN, TRANSITION_OUT } from "@/lib/motion"

/**
 * Capa que aparece mientras se arrastra un CV encima o se está leyendo: el haz `FlowBeam` recorre todo su borde y el mensaje queda centrado en
 * vertical y horizontal. La usan el panel «Mi CV» (cubre el panel) y la pantalla inicial (cubre la ventana, con `className="fixed inset-2"`), para que
 * el efecto sea el mismo. Entra y sale solo con opacity (sin `filter`, por fluidez). El haz solo aparece aquí (ver CLAUDE.md).
 */
export function CvDropOverlay({ show, className = "absolute inset-0", hidden = false, beam, children }: { show: boolean; className?: string; /** `aria-hidden` (p. ej. cuando solo es decorativo, al arrastrar) */ hidden?: boolean; /** vuelta (s) y densidad del haz; la ventana completa lo pide más rápido y más denso que el panel */ beam?: { lap?: number; density?: number; halo?: boolean }; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          data-drop-overlay
          aria-hidden={hidden}
          className={`pointer-events-none rounded-2xl ${className}`}
          // Solo opacity: un `filter` (aunque sea blur(0px)) sobre una capa del tamaño de la ventana la mantiene en una superficie propia y resta fluidez al haz.
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: TRANSITION_IN }}
          exit={{ opacity: 0, transition: TRANSITION_OUT }}
        >
          <FlowBeam className="rounded-2xl" lap={beam?.lap} density={beam?.density} halo={beam?.halo} />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
