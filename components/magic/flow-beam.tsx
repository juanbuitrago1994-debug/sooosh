"use client"

import { motion, useReducedMotion } from "motion/react"
import { EFFECT_COLORS } from "@/lib/design-tokens"

/**
 * FlowBeam — un haz de luz fría que recorre TODO el borde de un panel con movimiento continuo y suave (pedido por Juan el 23-nov-2026 para la
 * zona de soltar de «Mi CV»): un arco largo de dos tonos (gris azulado → azul) con la cola difuminada, una vuelta cada 9 s a velocidad
 * constante (`linear`), sin saltos. Son tres capas que giran juntas: un resplandor ancho y difuminado visible solo junto al borde (máscara
 * radial), un hilo nítido de 1 px sobre el borde (máscara de anillo) y un brillo interior tenue. Con «reducir movimiento» no gira: queda un
 * resplandor interior quieto. Decorativo (`aria-hidden`, sin clics). Hereda el radio de esquina con `className` (p. ej. `rounded-2xl`).
 * Solo colores de `EFFECT_COLORS` (`flow-blue`, `flow-gray`); el color se funde en oklab para que el degradado no ensucie los tonos.
 */
const LAP = 9
const [BLUE, GRAY] = [EFFECT_COLORS["flow-blue"], EFFECT_COLORS["flow-gray"]]
const mix = (c: string, pct: number) => `color-mix(in oklab, ${c} ${pct}%, transparent)`

// Arco de ~150°: cola larga y suave (gris azulado) que crece hacia la cabeza azul y cae rápido.
const ARC = `conic-gradient(in oklab from 0deg, transparent 0deg, transparent 200deg, ${mix(GRAY, 35)} 245deg, ${mix(GRAY, 70)} 290deg, ${mix(BLUE, 90)} 335deg, ${mix(BLUE, 100)} 350deg, transparent 360deg)`
const RIM = "radial-gradient(ellipse farthest-side at center, transparent 55%, black 100%)"
const RING = "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)"

// Un cuadro mucho mayor que el panel, centrado: al girar siempre cubre las esquinas, también en paneles altos y angostos.
const spinner = { left: "50%", top: "50%", width: "260%", height: "260%", marginLeft: "-130%", marginTop: "-130%" } as const
const spin = { animate: { rotate: 360 }, transition: { duration: LAP, ease: "linear" as const, repeat: Infinity } }

export function FlowBeam({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) {
    return <span aria-hidden className={`pointer-events-none absolute inset-0 ${className ?? ""}`} style={{ boxShadow: `inset 0 0 18px 2px ${mix(BLUE, 40)}` }} />
  }
  return (
    <div aria-hidden data-flow-beam className={`pointer-events-none absolute inset-0 ${className ?? ""}`}>
      {/* resplandor ancho, difuminado, solo junto al borde */}
      <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: "inherit", maskImage: RIM, WebkitMaskImage: RIM }}>
        <motion.span className="absolute" style={{ ...spinner, background: ARC, filter: "blur(22px)", opacity: 0.85 }} {...spin} />
      </div>
      {/* hilo nítido de 1 px sobre el borde */}
      <div
        className="absolute inset-0 overflow-hidden p-px"
        style={{ borderRadius: "inherit", maskImage: RING, WebkitMaskImage: RING, maskComposite: "exclude", WebkitMaskComposite: "xor" }}
      >
        <motion.span className="absolute" style={{ ...spinner, background: ARC }} {...spin} />
      </div>
    </div>
  )
}
