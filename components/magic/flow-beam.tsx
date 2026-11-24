"use client"

import { useReducedMotion } from "motion/react"
import { EFFECT_COLORS } from "@/lib/design-tokens"

/**
 * FlowBeam — port del mecanismo de `border-beam` (MIT; el mismo de https://libraries.dev/beam, leído de `node_modules/border-beam/dist`) con
 * una paleta de varios colores (azul, rosa, verde, turquesa, violeta, naranja y magenta; pedida por Juan el 23-nov-2026) para la zona de soltar de «Mi CV».
 *
 * Cómo funciona (igual que la librería): el color NO viaja. Hay manchas de color FIJAS repartidas por el borde y una máscara cónica cuyo
 * ángulo (`--fb-angle`, registrado con `@property` para poder animarlo) gira sin parar; la máscara solo deja ver las manchas por donde pasa, así
 * que la luz recorre el borde y cambia de tono a su paso. Tres capas, cada una con su opacidad:
 *  1) hilo de 1 px sobre el borde (anillo), con un núcleo claro en el centro del arco;
 *  2) brillo interior: las mismas manchas dentro del panel, en una franja fija de 28 px junto al borde que se desvanece hacia adentro;
 *  3) halo: el arco difuminado (8 px) que le da el resplandor.
 * Una vuelta cada 5 s a velocidad constante. Con «reducir movimiento» no gira: queda un resplandor interior quieto. Decorativo; el radio de
 * esquina se hereda del contenedor (`rounded-2xl`).
 */
const LAP = 5
const [BLUE, GRAY] = [EFFECT_COLORS["flow-blue"], EFFECT_COLORS["flow-gray"]]
// Un matiz por mancha, en el mismo orden y con los mismos matices que la variante `colorful` de la librería (rosa, azul, verde, turquesa, violeta, azul, naranja, magenta, azul).
const C = EFFECT_COLORS
const TONES = [C["flow-pink"], BLUE, C["flow-green"], C["flow-teal"], C["flow-violet"], BLUE, C["flow-orange"], C["flow-magenta"], BLUE]

// Posición y tamaño de las manchas del preset de borde de la librería (en % del panel y px).
const BLOBS = [
  ["33% -7.4%", "70px 40px"],
  ["12% -5%", "60px 35px"],
  ["2.1% 68.3%", "40px 70px"],
  ["2.1% 68.3%", "20px 35px"],
  ["74.4% 100%", "180px 32px"],
  ["55% 100%", "85px 26px"],
  ["93.9% 0%", "74px 32px"],
  ["100% 27.1%", "26px 42px"],
  ["100% 27.1%", "52px 48px"],
] as const

const blobs = (alpha: number, grow = 1) =>
  BLOBS.map(([pos, size], i) => {
    const [w, h] = size.split(" ").map((n) => `${Math.round(parseFloat(n) * grow)}px`)
    const c = alpha >= 1 ? TONES[i % TONES.length] : `color-mix(in oklab, ${TONES[i % TONES.length]} ${Math.round(alpha * 100)}%, transparent)`
    return `radial-gradient(ellipse ${w} ${h} at ${pos}, ${c}, transparent)`
  }).join(", ")

const CORE = `color-mix(in oklab, ${GRAY} 100%, white)`
const ARC_CORE = `conic-gradient(from var(--fb-angle), transparent 0%, transparent 54%, color-mix(in oklab, ${CORE} 10%, transparent) 57%, color-mix(in oklab, ${CORE} 30%, transparent) 60%, color-mix(in oklab, ${CORE} 60%, transparent) 63%, color-mix(in oklab, ${CORE} 75%, transparent) 66%, color-mix(in oklab, ${CORE} 60%, transparent) 69%, color-mix(in oklab, ${CORE} 30%, transparent) 72%, color-mix(in oklab, ${CORE} 10%, transparent) 75%, transparent 78%, transparent 100%)`
const MASK_ARC = "conic-gradient(from var(--fb-angle), transparent 0%, transparent 30%, rgba(255,255,255,.1) 36%, rgba(255,255,255,.35) 44%, white 52%, white 80%, rgba(255,255,255,.35) 86%, rgba(255,255,255,.1) 92%, transparent 95%, transparent 100%)"
const EDGE = "linear-gradient(white, transparent 28px, transparent calc(100% - 28px), white), linear-gradient(to right, white, transparent 28px, transparent calc(100% - 28px), white)"
const BLOOM_ARC = `conic-gradient(from var(--fb-angle), transparent 0%, transparent 58%, color-mix(in oklab, ${BLUE} 5%, transparent) 62%, color-mix(in oklab, ${BLUE} 20%, transparent) 66%, color-mix(in oklab, ${BLUE} 70%, transparent) 69%, color-mix(in oklab, ${CORE} 85%, transparent) 70.5%, color-mix(in oklab, ${BLUE} 45%, transparent) 72%, color-mix(in oklab, ${BLUE} 12%, transparent) 76%, transparent 82%)`

// Opacidades por capa (las de la librería multiplicadas por 3: sobre el fondo oscuro del panel, las originales casi no se ven).
const STYLE = `
@property --fb-angle { syntax: "<angle>"; initial-value: 0deg; inherits: true; }
@keyframes fb-spin { to { --fb-angle: 360deg; } }
[data-flow-beam] { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; pointer-events: none; animation: fb-spin ${LAP}s linear infinite; }
[data-flow-beam]::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; z-index: 2; opacity: .6;
  background: ${ARC_CORE}, ${blobs(1)};
  -webkit-mask: ${MASK_ARC}, linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: source-in, xor;
  mask: ${MASK_ARC}, linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: intersect, exclude;
}
[data-flow-beam]::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; z-index: 1; opacity: .63;
  background: ${blobs(0.22, 0.9)};
  box-shadow: inset 0 0 9px 1px color-mix(in oklab, ${BLUE} 27%, transparent);
  -webkit-mask-image: ${MASK_ARC}, ${EDGE};
  -webkit-mask-composite: source-in, source-over;
  mask-image: ${MASK_ARC}, ${EDGE};
  mask-composite: intersect, add;
}
[data-flow-beam] > span {
  position: absolute; inset: 0; border-radius: inherit; padding: 1px; z-index: 3; opacity: .36;
  background: ${BLOOM_ARC};
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); mask-composite: exclude;
  filter: blur(8px) brightness(1.3) saturate(1.2);
}
`

export function FlowBeam({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) {
    return <span aria-hidden className={`pointer-events-none absolute inset-0 ${className ?? ""}`} style={{ boxShadow: `inset 0 0 18px 2px color-mix(in oklab, ${BLUE} 35%, transparent)` }} />
  }
  return (
    <div aria-hidden data-flow-beam className={className}>
      <style>{STYLE}</style>
      <span />
    </div>
  )
}
