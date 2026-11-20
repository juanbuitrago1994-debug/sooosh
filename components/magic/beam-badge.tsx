"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"
import { useTheme } from "next-themes"
import { EFFECT_COLORS } from "@/lib/design-tokens"
import { MOTION } from "@/lib/motion"

/** Relleno horizontal del distintivo (px-4 = 16 px por lado): sirve para fijar su ancho a lo que mide el contenido. */
const CHROME = 2 * 16

/** Colores del haz por tema: fríos en oscuro (azul hielo → lila pálido) y cálidos en claro (rosa → naranja). */
export const beamColors = (theme: "light" | "dark"): [string, string] => (theme === "light" ? [EFFECT_COLORS["beam-rose"], EFFECT_COLORS["beam-orange"]] : [EFFECT_COLORS["beam-ice"], EFFECT_COLORS["beam-lilac"]])

/** Un solo haz con DOS colores que se funden entre sí: la cola nace transparente, pasa por el primero y termina (la cabeza) en el segundo. */
const tint = (color: string) => `color-mix(in oklab, ${color} 62%, transparent)`
export const beamGradient = (theme: "light" | "dark"): string => {
  const [a, b] = beamColors(theme)
  return `conic-gradient(in oklab from 0deg, transparent 0deg, transparent 245deg, ${tint(a)} 305deg, ${tint(b)} 360deg)`
}
const RIM = "radial-gradient(ellipse farthest-side at center, transparent 30%, black 100%)"

/**
 * Distintivo de fondo SÓLIDO y ligeramente distinto al de la app (`muted` en claro, un gris ligero; `card` en oscuro), SIN borde, con una luz que **recorre el borde por dentro** (una vuelta cada 6 s, la
 * misma que tenía el haz original): un arco de luz difuminado que gira y que una máscara radial deja ver solo junto al borde. Un solo haz con dos colores fríos fundidos (azul hielo → lila pálido), sin manchas
 * ni anillo. El ancho se anima (300 ms, la curva de la app) cuando el contenido cambia de largo. Con «reducir movimiento» no gira y queda un resplandor
 * interior quieto. Decorativo: no recibe clics.
 */
export function BeamBadge({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  const { resolvedTheme } = useTheme()
  const gradient = beamGradient(resolvedTheme === "light" ? "light" : "dark")
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
      className={`relative flex justify-center overflow-hidden rounded-full bg-muted px-4 py-2 text-xs dark:bg-card ${className ?? ""}`}
      style={{ width: width === null ? undefined : width + CHROME, transition: reduce ? undefined : `width 300ms cubic-bezier(${MOTION.ease.join(",")})` }}
    >
      {reduce ? (
        <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: "inset 0 0 10px 1px color-mix(in oklab, var(--foreground) 14%, transparent)" }} />
      ) : (
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full" style={{ maskImage: RIM, WebkitMaskImage: RIM }}>
          <motion.span
            className="absolute"
            style={{ left: "50%", top: "50%", width: 320, height: 320, marginLeft: -160, marginTop: -160, background: gradient, filter: "blur(8px)" }}
            animate={{ rotate: 360 }}
            transition={{ duration: 6, ease: "linear", repeat: Infinity }}
          />
        </div>
      )}
      <span ref={content} className="relative inline-flex shrink-0">
        {children}
      </span>
    </div>
  )
}
