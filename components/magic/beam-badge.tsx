"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useReducedMotion } from "motion/react"
import { Beam } from "@/components/magic/beam"
import { MOTION } from "@/lib/motion"

/** Relleno horizontal (px-4 = 16 px por lado) y borde (1 px por lado) del distintivo: sirven para fijar su ancho a lo que mide el contenido. */
const CHROME = 2 * 16 + 2

/**
 * Distintivo de fondo SÓLIDO (no deja ver lo que pasa por detrás) con un resplandor interior sutil que respira (`Beam` en estilo `pulse-inner`, paleta `ice` fija y poco saturada: grises fríos y azules pálidos) y un borde casi transparente SIN efecto beam. El ancho se anima (300 ms, la curva de la app)
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

  // `ice` fijo (sin el ciclo de tono de la librería) y poco saturado: solo grises fríos y azules pálidos.
  return (
    <Beam size="pulse-inner" colorVariant="ice" staticColors saturation={0.4}>
      <div
        className={`relative flex justify-center overflow-hidden rounded-full bg-background px-4 py-2 text-xs ${className ?? ""}`}
        style={{ width: width === null ? undefined : width + CHROME, transition: reduce ? undefined : `width 300ms cubic-bezier(${MOTION.ease.join(",")})` }}
      >
        <span ref={content} className="inline-flex shrink-0">
          {children}
        </span>
        {/* Borde propio: un anillo OPACO de 1 px, casi transparente a la vista (10 % del color del texto sobre el fondo), por encima del trazo del haz de la
            librería. Así el borde no lleva efecto beam y solo se ve el resplandor interior. */}
        <span aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-full border" style={{ borderColor: "color-mix(in oklab, var(--foreground) 10%, var(--background))" }} />
      </div>
    </Beam>
  )
}
