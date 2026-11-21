"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { DotLoader, type DotVariant } from "@/components/ai/dot-loader"
import { MOTION, TRANSITION_IN, TRANSITION_OUT } from "@/lib/motion"
import { cn } from "@/lib/utils"

/**
 * LoadingState — reemplaza a los esqueletos: el cargador de puntos de transitions.dev (`DotLoader`, 14 px, medidas exactas de la referencia) y, a su derecha (siempre en la misma línea), una frase que cambia sola cada
 * 2,4 s para explicar qué está haciendo la plataforma. La frase entra desde abajo desenfocándose hasta quedar nítida y la anterior sale hacia
 * arriba difuminándose (la misma animación que el número de «Ofertas encontradas»). Con «reducir movimiento»: puntos quietos y frases sin animar.
 * Los lectores de pantalla oyen solo la primera frase, una vez (el resto es decoración).
 */
export function LoadingState({ messages, interval = 2400, variant = "scan", size = "md", className }: { messages: string[]; interval?: number; /** «sm»: versión para un distintivo (texto `text-xs`, frase más angosta) */ size?: "md" | "sm"; variant?: DotVariant; className?: string }) {
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)

  useEffect(() => {
    if (messages.length < 2) return
    const t = setInterval(() => setI((n) => (n + 1) % messages.length), interval)
    return () => clearInterval(t)
  }, [messages.length, interval])

  const text = messages[i] ?? ""
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center justify-center", size === "sm" ? "gap-2" : "gap-3", className)}>
      <span className="sr-only">{messages[0]}</span>
      <DotLoader variant={variant} />
      <div aria-hidden className={cn("relative flex items-center text-left text-muted-foreground", size === "sm" ? "h-4 w-36 text-xs" : "h-5 w-64 text-sm")}>
        {reduce ? (
          <span>{text}</span>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={text}
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
