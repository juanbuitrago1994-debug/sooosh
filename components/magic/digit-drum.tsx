"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"

/** Miles con punto, siempre (también en 4 cifras): 1450 → «1.450». */
export const formatThousands = (n: number) => String(Math.max(0, Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".")

/** Un dígito que gira como un tambor 3D: el anterior sale rodando hacia arriba y el nuevo entra desde abajo con un pequeño rebote. */
function Digit({ char }: { char: string }) {
  const reduce = useReducedMotion()
  if (reduce || !/\d/.test(char)) return <span>{char}</span>
  return (
    <span className="relative inline-block overflow-hidden align-bottom" style={{ perspective: 240, height: "1.3em", lineHeight: "1.3em" }} aria-hidden>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={char}
          className="inline-block"
          style={{ transformOrigin: "50% 50% -0.5em", backfaceVisibility: "hidden" }}
          initial={{ rotateX: -80, y: "55%", opacity: 0 }}
          animate={{ rotateX: 0, y: "0%", opacity: 1, transition: { type: "spring", stiffness: 380, damping: 22, mass: 0.8 } }}
          exit={{ rotateX: 80, y: "-55%", opacity: 0, transition: { duration: 0.16, ease: "easeIn" } }}
        >
          {char}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/**
 * Número que cambia con el efecto «number pop-in» (los dígitos giran en un tambor 3D con un rebote corto; transitions.dev).
 * Cada dígito se identifica por su posición desde la derecha: al pasar de 1.450 a 1.452 solo gira el último. Con «reducir movimiento» cambia sin animar.
 * Lectores de pantalla: se anuncia el número completo una sola vez.
 */
export function DrumNumber({ value, className }: { value: number; className?: string }) {
  const text = formatThousands(value)
  const chars = text.split("")
  return (
    <span className={`inline-flex tabular-nums ${className ?? ""}`} role="text" aria-label={text}>
      {chars.map((c, i) => (
        <Digit key={chars.length - i} char={c} />
      ))}
    </span>
  )
}
