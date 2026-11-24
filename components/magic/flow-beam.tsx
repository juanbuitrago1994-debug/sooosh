"use client"

import { motion, useReducedMotion } from "motion/react"
import { EFFECT_COLORS } from "@/lib/design-tokens"

/**
 * FlowBeam — la MISMA técnica del haz del distintivo «Ofertas encontradas» (un arco de luz difuminado que gira y que una máscara deja ver solo
 * junto al borde, por dentro), llevada a un panel grande (pedido por Juan el 23-nov-2026 para la zona de soltar de «Mi CV»). Un solo haz con
 * DOS tonos fríos fundidos en oklab (cola gris azulado → cabeza azul, al 62 % como el original), cola larga que nace transparente.
 * Diferencia con el distintivo: allí la máscara es radial porque el elemento es pequeño; en un panel alto eso se vuelve una mancha enorme, así
 * que aquí la franja visible es de ancho FIJO (36 px) y se desvanece hacia adentro, igual en cualquier tamaño. Una vuelta cada 8 s, velocidad
 * constante. Con «reducir movimiento» no gira: queda un resplandor interior quieto. Decorativo; el radio de esquina se hereda de `className`.
 */
const LAP = 8
const BAND = "36px"
const [BLUE, GRAY] = [EFFECT_COLORS["flow-blue"], EFFECT_COLORS["flow-gray"]]
const tint = (c: string) => `color-mix(in oklab, ${c} 62%, transparent)`

const ARC = `conic-gradient(in oklab from 0deg, transparent 0deg, transparent 200deg, ${tint(GRAY)} 260deg, ${tint(BLUE)} 330deg, ${tint(BLUE)} 352deg, transparent 360deg)`
// Franja de ancho fijo pegada al borde, con caída suave hacia adentro (unión de las dos bandas: arriba/abajo y izquierda/derecha).
const BAND_MASK = `linear-gradient(white, transparent ${BAND}, transparent calc(100% - ${BAND}), white), linear-gradient(to right, white, transparent ${BAND}, transparent calc(100% - ${BAND}), white)`

// Un cuadro mucho mayor que el panel, centrado: al girar siempre cubre las esquinas, también en paneles altos y angostos.
const spinner = { left: "50%", top: "50%", width: "260%", height: "260%", marginLeft: "-130%", marginTop: "-130%" } as const

export function FlowBeam({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) {
    return <span aria-hidden className={`pointer-events-none absolute inset-0 ${className ?? ""}`} style={{ boxShadow: `inset 0 0 18px 2px color-mix(in oklab, ${BLUE} 35%, transparent)` }} />
  }
  return (
    <div
      aria-hidden
      data-flow-beam
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}
      style={{ maskImage: BAND_MASK, WebkitMaskImage: BAND_MASK, maskComposite: "add", WebkitMaskComposite: "source-over" }}
    >
      <motion.span
        className="absolute"
        style={{ ...spinner, background: ARC, filter: "blur(14px)" }}
        animate={{ rotate: 360 }}
        transition={{ duration: LAP, ease: "linear", repeat: Infinity }}
      />
    </div>
  )
}
