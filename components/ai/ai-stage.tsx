"use client"

import type { ReactNode } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Button } from "@/components/ui/button"
import { MOTION, TRANSITION_IN, TRANSITION_OUT } from "@/lib/motion"
import { AiAura } from "./ai-aura"
import { MatrixLoader, patternForStep } from "./matrix-loader"
import { ThinkingTicker } from "./thinking-ticker"

/**
 * AiStage — al recibir "trabajando": el contenido se atenúa y se desenfoca apenas, aparece el AiAura
 * (luz ambiental lenta) y un overlay con Spinner + ThinkingTicker (+ "Cancelar" si hay `onCancel`).
 * Envuelve la tarjeta principal: el contenedor debe tener radio (hereda `inherit`).
 */
export function AiStage({
  working,
  messages,
  step,
  onCancel,
  className,
  children,
}: {
  working: boolean
  messages: string[]
  step: number
  onCancel?: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`relative ${className ?? ""}`} aria-busy={working}>
      <motion.div
        animate={{
          opacity: working ? MOTION.waitOpacity : 1,
          filter: working ? `blur(${MOTION.waitBlur}px)` : "blur(0px)",
          transition: working ? TRANSITION_IN : TRANSITION_OUT,
        }}
        inert={working}
        style={{ borderRadius: "inherit" }}
      >
        {children}
      </motion.div>
      <AiAura active={working} />
      <AnimatePresence>
        {working && (
          <motion.div
            key="overlay"
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 p-6"
            style={{ borderRadius: "inherit" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: TRANSITION_IN }}
            exit={{ opacity: 0, transition: TRANSITION_OUT }}
          >
            {/* El contenido en espera es inerte: este título mantiene un h1 mientras la IA trabaja. */}
            <h1 className="sr-only">La IA está trabajando</h1>
            <MatrixLoader pattern={patternForStep(step)} />
            <ThinkingTicker messages={messages} step={step} />
            {onCancel && (
              <Button variant="ghost" className="h-11" onClick={onCancel}>
                Cancelar
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
