"use client"

import { motion, useReducedMotion } from "motion/react"
import { MOTION } from "@/lib/motion"

/**
 * MatrixLoader — matriz de 4×4 puntos que pulsan con un patrón de retardos.
 * Idea inspirada en el «Matrix dot loader» de transitions.dev, reimplementada con `motion` y tokens del tema.
 * Solo anima opacidad (regla de movimiento); con prefers-reduced-motion queda quieta, en media opacidad.
 * Es decorativa (`aria-hidden`): el estado se comunica con el ThinkingTicker (`role="status"`).
 */
export const MATRIX_PATTERNS = ["ola", "onda", "barrido", "espiral"] as const
export type MatrixPattern = (typeof MATRIX_PATTERNS)[number]

const SIZE = 4
const CELLS = Array.from({ length: SIZE * SIZE }, (_, i) => ({ r: Math.floor(i / SIZE), c: i % SIZE }))

/** Recorrido en espiral hacia el centro (posición de cada celda en la espiral). */
const SPIRAL = (() => {
  const order = new Map<number, number>()
  let top = 0, bottom = SIZE - 1, left = 0, right = SIZE - 1, n = 0
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) order.set(top * SIZE + c, n++)
    top++
    for (let r = top; r <= bottom; r++) order.set(r * SIZE + right, n++)
    right--
    if (top <= bottom) for (let c = right; c >= left; c--) order.set(bottom * SIZE + c, n++)
    bottom--
    if (left <= right) for (let r = bottom; r >= top; r--) order.set(r * SIZE + left, n++)
    left++
  }
  return order
})()

/** Posición (0…n) de una celda dentro del patrón: define cuándo se enciende respecto a las demás. */
export function patternOrder(pattern: MatrixPattern, r: number, c: number): number {
  const mid = (SIZE - 1) / 2
  switch (pattern) {
    case "ola": // diagonal
      return r + c
    case "onda": // desde el centro hacia afuera
      return Math.round(Math.hypot(r - mid, c - mid) * 2)
    case "barrido": // fila a fila
      return r * 2 + (c % 2)
    case "espiral":
      return SPIRAL.get(r * SIZE + c) ?? 0
  }
}

/** El patrón sigue el paso real del análisis: cada etapa se ve distinta. */
export const patternForStep = (step: number): MatrixPattern => MATRIX_PATTERNS[Math.abs(step) % MATRIX_PATTERNS.length]

export function MatrixLoader({ pattern = "ola", size = "md", className }: { pattern?: MatrixPattern; size?: "sm" | "md"; className?: string }) {
  const reduce = useReducedMotion()
  const start = reduce ? 0.5 : MOTION.dotMin
  return (
    <div aria-hidden data-pattern={pattern} data-size={size}
      className={`grid grid-cols-4 ${size === "sm" ? "gap-0.5" : "gap-1.5"} text-foreground ${className ?? ""}`}>
      {CELLS.map(({ r, c }) => (
        <motion.span
          key={`${pattern}-${r}-${c}`}
          className={`${size === "sm" ? "size-1" : "size-2"} rounded-full bg-current`}
          initial={{ opacity: start }}
          animate={reduce ? undefined : { opacity: [MOTION.dotMin, MOTION.dotMax, MOTION.dotMin] }}
          transition={{ duration: MOTION.dotCycle, ease: "easeInOut", repeat: Infinity, delay: patternOrder(pattern, r, c) * MOTION.dotStagger }}
        />
      ))}
    </div>
  )
}
