"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"
import { MOTION } from "@/lib/motion"

/** Relleno horizontal del distintivo (px-4 = 16 px por lado): sirve para fijar su ancho a lo que mide el contenido. */
const CHROME = 2 * 16

/**
 * Distintivo de fondo SÓLIDO y ligeramente distinto al de la app (`card`), SIN borde, con un resplandor interior uniforme que respira muy despacio
 * (una sombra interior suave que sube y baja de opacidad, del color del texto del tema). Reemplaza a `Beam`/`border-beam` en este componente: esa librería
 * dibuja manchas de color ancladas al borde (de ahí los «puntos de color») y obligaba a tapar su trazo con un anillo, que dejaba un contorno oscuro.
 * El ancho se anima (300 ms, la curva de la app) cuando el contenido cambia de largo (idea de «Card resize» de transitions.dev). Con «reducir
 * movimiento» el resplandor queda quieto y el ancho cambia sin animar. Decorativo: no recibe clics.
 */
export function BeamBadge({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  const content = useRef<HTMLSpanElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    const el = content.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.ceil(entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      className={`relative flex justify-center overflow-hidden rounded-full bg-card px-4 py-2 text-xs ${className ?? ""}`}
      style={{ width: width === null ? undefined : width + CHROME, transition: reduce ? undefined : `width 300ms cubic-bezier(${MOTION.ease.join(",")})` }}
    >
      <span ref={content} className="relative inline-flex shrink-0">
        {children}
      </span>
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ boxShadow: "inset 0 0 12px 1px color-mix(in oklab, var(--foreground) 20%, transparent)" }}
        initial={{ opacity: reduce ? 0.6 : 0.35 }}
        animate={reduce ? undefined : { opacity: [0.35, 1, 0.35] }}
        transition={{ duration: MOTION.wave, ease: "easeInOut", repeat: Infinity }}
      />
    </div>
  )
}
