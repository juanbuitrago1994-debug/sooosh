"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"
import { MOTION } from "@/lib/motion"

/** Color único del haz: el principal del tema (blanco en oscuro) con poca opacidad. Sin degradados de varios colores. */
const BEAM = "conic-gradient(from 0deg, transparent 0deg, transparent 290deg, var(--primary) 360deg)"
const GLOW = "conic-gradient(from 0deg, transparent 0deg, transparent 280deg, color-mix(in oklab, var(--primary) 32%, transparent) 360deg)"

/**
 * Distintivo con un haz de luz que recorre su borde (una vuelta cada 6 s) y, muy sutil, un resplandor que entra desde el borde hacia el interior
 * (la idea del «Get Pro button» de transitions.dev: «gradient glows in from the pill's rim», aquí en un solo color). El ancho se anima
 * (300 ms, la curva de la app) cuando el contenido cambia de largo, p. ej. de 999 a 1.000 ofertas. Con «reducir movimiento» queda solo el borde
 * tenue y el ancho cambia sin animar. Decorativo: no recibe clics.
 */
export function BeamBadge({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  const content = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    const el = content.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(Math.ceil(entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const spin = { animate: { rotate: 360 }, transition: { duration: 6, ease: "linear" as const, repeat: Infinity } }
  return (
    <div
      className={`relative inline-flex overflow-hidden rounded-full bg-border/50 p-px ${className ?? ""}`}
      style={{ width: width === null ? undefined : width + 2, transition: reduce ? undefined : `width 300ms cubic-bezier(${MOTION.ease.join(",")})` }}
    >
      {!reduce && (
        <motion.span aria-hidden className="absolute" style={{ left: "50%", top: "50%", width: 480, height: 480, marginLeft: -240, marginTop: -240, background: BEAM }} {...spin} />
      )}
      <div ref={content} className="relative w-max overflow-hidden rounded-full bg-background/85 px-4 py-2 text-xs backdrop-blur-xl">
        {!reduce && (
          // Resplandor interior: el mismo giro del haz, difuminado y enmascarado para que se desvanezca hacia el centro (solo se nota junto al borde).
          <div aria-hidden className="absolute inset-0 rounded-full" style={{ maskImage: "radial-gradient(ellipse farthest-side at center, transparent 35%, black 100%)", WebkitMaskImage: "radial-gradient(ellipse farthest-side at center, transparent 35%, black 100%)" }}>
            <motion.span className="absolute" style={{ left: "50%", top: "50%", width: 320, height: 320, marginLeft: -160, marginTop: -160, background: GLOW, filter: "blur(10px)" }} {...spin} />
          </div>
        )}
        <span className="relative">{children}</span>
      </div>
    </div>
  )
}
