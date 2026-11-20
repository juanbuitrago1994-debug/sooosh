"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { MOTION } from "@/lib/motion"

/** Miles con punto, siempre (también en 4 cifras): 1450 → «1.450». */
export const formatThousands = (n: number) => String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".")

/**
 * Un dígito que gira suave como un tambor: el anterior sale rodando hacia arriba mientras se difumina y el nuevo entra desde abajo desenfocándose
 * hasta quedar nítido. Sin rebote: una sola curva de desaceleración (la de toda la app). `delay` escalona los dígitos de derecha a izquierda.
 */
function Digit({ char, delay }: { char: string; delay: number }) {
  const reduce = useReducedMotion()
  if (reduce || !/\d/.test(char)) return <span>{char}</span>
  return (
    <span className="relative inline-block overflow-hidden align-bottom" style={{ perspective: 240, height: "1.3em", lineHeight: "1.3em" }} aria-hidden>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={char}
          className="inline-block"
          style={{ transformOrigin: "50% 50% -0.5em", backfaceVisibility: "hidden" }}
          initial={{ rotateX: -35, y: "60%", opacity: 0, filter: "blur(6px)" }}
          animate={{ rotateX: 0, y: "0%", opacity: 1, filter: "blur(0px)", transition: { duration: 0.5, ease: MOTION.ease, delay } }}
          exit={{ rotateX: 35, y: "-60%", opacity: 0, filter: "blur(6px)", transition: { duration: 0.32, ease: MOTION.ease, delay } }}
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/**
 * Número que cambia con un efecto de tambor suave (inspirado en «number pop-in» de transitions.dev, pero sin rebote y con desenfoque).
 * Cada dígito se identifica por su posición desde la derecha: al pasar de 1.450 a 1.452 solo gira el último. Con «reducir movimiento» cambia sin animar.
 * Lectores de pantalla: se anuncia el número completo una sola vez.
 */
export function DrumNumber({ value, className }: { value: number; className?: string }) {
  const text = formatThousands(value)
  const chars = text.split("")
  return (
    <span className={`inline-flex tabular-nums ${className ?? ""}`} role="text" aria-label={text}>
      {chars.map((c, i) => (
        <Digit key={chars.length - i} char={c} delay={(chars.length - 1 - i) * 0.035} />
      ))}
    </span>
  )
}
