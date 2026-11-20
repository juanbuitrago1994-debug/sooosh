"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { DotLoader, type DotVariant } from "@/components/ai/dot-loader"
import { MOTION, TRANSITION_IN, TRANSITION_OUT } from "@/lib/motion"
import { cn } from "@/lib/utils"

/**
 * LoadingState — reemplaza a los esqueletos: el cargador de puntos de transitions.dev (`DotLoader`, 14 px, medidas exactas de la referencia) y debajo una frase que cambia sola cada
 * 2,4 s para explicar qué está haciendo la plataforma. La frase entra desde abajo desenfocándose hasta quedar nítida y la anterior sale hacia
 * arriba difuminándose (la misma animación que el número de «Ofertas encontradas»). Con «reducir movimiento»: puntos quietos y frases sin animar.
 * Los lectores de pantalla oyen solo la primera frase, una vez (el resto es decoración).
 */
export function LoadingState({ messages, interval = 2400, variant = "twinkle", className }: { messages: string[]; interval?: number; variant?: DotVariant; className?: string }) {
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)

  useEffect(() => {
    if (messages.length < 2) return
    const t = setInterval(() => setI((n) => (n + 1) % messages.length), interval)
    return () => clearInterval(t)
  }, [messages.length, interval])

  const text = messages[i] ?? ""
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center gap-3 text-center", className)}>
      <span className="sr-only">{messages[0]}</span>
      <DotLoader variant={variant} />
      <div aria-hidden className="relative flex h-5 items-center justify-center text-sm text-muted-foreground">
        {reduce ? (
          <span>{text}</span>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={i}
              className="whitespace-nowrap"
              initial={{ opacity: 0, y: MOTION.offset, filter: `blur(${MOTION.blur}px)` }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: TRANSITION_IN }}
              exit={{ opacity: 0, y: -MOTION.offset, filter: `blur(${MOTION.blur}px)`, transition: TRANSITION_OUT }}
            >
              {text}
            </motion.span>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
