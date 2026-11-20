"use client"

import type { ComponentProps } from "react"
import { motion, useReducedMotion } from "motion/react"
import { MOTION } from "@/lib/motion"

/** Duración de la subida (más corta que la entrada estándar: es una microinteracción al cambiar de vista) y retardo entre elementos, en segundos. */
export const RISE = { duration: 0.42, travel: 16, step: 0.07 } as const

/**
 * Entrada «de abajo hacia arriba» de los elementos de una vista: aparecen con un fundido mientras suben unos píxeles, con la curva de
 * desaceleración suave de toda la app y un pequeño retardo (`step`) entre un elemento y el siguiente. Solo anima opacidad y desplazamiento.
 * Con «reducir movimiento» no anima nada.
 */
export function Rise({ step = 0, className, children, ...props }: { step?: number } & Omit<ComponentProps<"div">, "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "style">) {
  const reduce = useReducedMotion()
  if (reduce) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    )
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: RISE.travel }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: RISE.duration, ease: MOTION.ease, delay: step * RISE.step }}
      {...props}
    >
      {children}
    </motion.div>
  )
}
