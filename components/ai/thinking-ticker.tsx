"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { MOTION, TRANSITION_IN, TRANSITION_OUT } from "@/lib/motion"

/**
 * ThinkingTicker — mensaje de estado de la IA.
 * Cada palabra entra con blur + translate + opacity (escalonadas) y luego "respira" con una onda lenta de
 * opacidad. Cambia SOLO cuando cambia `step` (el paso real del pipeline), nunca por temporizador.
 * El texto completo va una vez en `sr-only` para lectores de pantalla (`role="status"`).
 */
export function ThinkingTicker({ messages, step, className }: { messages: string[]; step: number; className?: string }) {
  const reduce = useReducedMotion()
  const i = Math.max(0, Math.min(step, messages.length - 1))
  const text = messages[i] ?? ""
  const y = reduce ? 0 : MOTION.offset
  const blur = reduce ? 0 : MOTION.blur

  return (
    <div role="status" aria-live="polite" className={cn("w-full text-center text-sm font-medium text-balance", className)}>
      <span className="sr-only">{text}</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={i} aria-hidden exit={{ opacity: 0, y: -y, filter: `blur(${blur}px)`, transition: TRANSITION_OUT }}>
          {text.split(" ").map((word, k) => (
            <motion.span
              key={k}
              className="me-1 inline-block"
              initial={{ opacity: 0, y, filter: `blur(${blur}px)` }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ ...TRANSITION_IN, delay: reduce ? 0 : k * MOTION.wordStagger }}
            >
              <motion.span
                className="inline-block"
                animate={reduce ? undefined : { opacity: [1, 0.55, 1] }}
                transition={{ duration: MOTION.wave, ease: "easeInOut", repeat: Infinity, delay: MOTION.enter + k * MOTION.waveDelay }}
              >
                {word}
              </motion.span>
            </motion.span>
          ))}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}
