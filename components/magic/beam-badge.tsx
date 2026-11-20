"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useReducedMotion } from "motion/react"
import { Beam } from "@/components/magic/beam"
import { MOTION } from "@/lib/motion"

/** Relleno horizontal (px-4 = 16 px por lado) y borde (1 px por lado) del distintivo: sirven para fijar su ancho a lo que mide el contenido. */
const CHROME = 2 * 16 + 2

/**
 * Distintivo con un resplandor interior sutil que respira (`Beam` en estilo `pulse-inner`, un solo color). El ancho se anima (300 ms, la curva de la app)
 * cuando el contenido cambia de largo, p. ej. de 999 a 1.000 ofertas (idea de la transición «Card resize» de transitions.dev). Con «reducir movimiento»
 * el ancho cambia sin animar. Decorativo: no recibe clics.
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
    <Beam size="pulse-inner">
      <div
        className={`flex justify-center overflow-hidden rounded-full border border-border/60 bg-background/85 px-4 py-2 text-xs backdrop-blur-xl ${className ?? ""}`}
        style={{ width: width === null ? undefined : width + CHROME, transition: reduce ? undefined : `width 300ms cubic-bezier(${MOTION.ease.join(",")})` }}
      >
        <span ref={content} className="inline-flex shrink-0">
          {children}
        </span>
      </div>
    </Beam>
  )
}
