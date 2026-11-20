"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { MOTION, TRANSITION_IN, TRANSITION_OUT } from "@/lib/motion"

/** Una mancha de luz difuminada que deriva muy despacio (solo translate). Color: variable del tema. */
function Blob({ color, className, x, y, seconds, drift }: { color: string; className: string; x: number[]; y: number[]; seconds: number; drift?: boolean }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      aria-hidden
      data-ai-drift={drift ? "" : undefined}
      className={`absolute size-72 rounded-full opacity-25 blur-3xl ${className}`}
      style={{ background: `radial-gradient(closest-side, ${color}, transparent)` }}
      animate={reduce ? undefined : { x, y }}
      transition={{ duration: seconds, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
    />
  )
}

/**
 * AiAura — luz ambiental muy tenue dentro de la tarjeta mientras la IA trabaja.
 * Sin bordes ni giros: dos manchas difuminadas derivan despacio (translate) y aparecen/desaparecen con opacity.
 * Usa solo variables del tema. El contenedor debe ser `relative` y tener radio.
 */
export function AiAura({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="aura"
          data-ai-aura
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
          style={{ borderRadius: "inherit" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: TRANSITION_IN }}
          exit={{ opacity: 0, transition: TRANSITION_OUT }}
        >
          <Blob drift color="var(--primary)" className="-top-24 -left-20" x={[0, 70, -10, 0]} y={[0, 40, 80, 0]} seconds={MOTION.drift} />
          <Blob color="var(--chart-4)" className="-right-24 -bottom-24" x={[0, -60, 20, 0]} y={[0, -50, -10, 0]} seconds={MOTION.drift * 1.3} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
