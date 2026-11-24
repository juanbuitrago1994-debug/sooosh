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
/** Valores por defecto (el panel «Mi CV»); la ventana completa pide una vuelta más corta y un haz más denso. */
const LAP = 5
const clamp1 = (n: number) => Math.min(1, n)
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
/**
 * Anillo de color CONTINUO (modo `continuous`): un solo degradado cónico con los colores de la paleta repartidos por todo el contorno, en vez de las
 * 9 manchas sueltas del preset de la librería. Las manchas están calculadas para un panel de ≈ 450 px; en una ventana de 1.280 px solo el 5–22 % del
 * borde tenía color en cada instante, con huecos oscuros largos (medido en WebKit), y los colores aparecían a saltos. Con el anillo, la luz que
 * recorre el borde lleva color siempre y el color cambia de forma gradual. Mismo mecanismo (colores fijos, máscara cónica que gira) y una sola capa.
 */
const PALETTE = [C["flow-orange"], C["flow-pink"], C["flow-magenta"], C["flow-violet"], BLUE, C["flow-teal"], C["flow-green"]]
const colorRing = (alpha: number) => `conic-gradient(in oklab from 0deg, ${[...PALETTE, PALETTE[0]].map((c, i) => `color-mix(in oklab, ${c} ${Math.round(alpha * 100)}%, transparent) ${((i * 360) / PALETTE.length).toFixed(1)}deg`).join(", ")})`

/** `density` multiplica la opacidad de las tres capas y el tamaño de las manchas de color: más denso = más luz y más ancha. */
const buildStyle = (lap: number, density: number, continuous: boolean) => `
@property --fb-angle { syntax: "<angle>"; initial-value: 0deg; inherits: true; }
@keyframes fb-spin { to { --fb-angle: 360deg; } }
[data-flow-beam] { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; pointer-events: none; animation: fb-spin ${lap}s linear infinite; }
[data-flow-beam]::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; padding: 1px; z-index: 2; opacity: ${clamp1(0.6 * density)};
  background: ${ARC_CORE}, ${continuous ? colorRing(1) : blobs(1, density)};
  -webkit-mask: ${MASK_ARC}, linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: source-in, xor;
  mask: ${MASK_ARC}, linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: intersect, exclude;
}
[data-flow-beam]::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; z-index: 1; opacity: ${clamp1(0.63 * density)};
  background: ${continuous ? colorRing(Math.min(1, 0.45 * density)) : blobs(Math.min(1, 0.22 * density), 0.9 * density)};
  box-shadow: inset 0 0 9px 1px color-mix(in oklab, ${BLUE} 27%, transparent);
  -webkit-mask-image: ${MASK_ARC}, ${EDGE};
  -webkit-mask-composite: source-in, source-over;
  mask-image: ${MASK_ARC}, ${EDGE};
  mask-composite: intersect, add;
}
[data-flow-beam] > span {
  position: absolute; inset: 0; border-radius: inherit; padding: 1px; z-index: 3; opacity: ${clamp1(0.36 * density)};
  background: ${BLOOM_ARC};
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); mask-composite: exclude;
  filter: blur(8px) brightness(1.3) saturate(1.2);
}
`

export function FlowBeam({ className, lap = LAP, density = 1, halo = true, continuous = false }: { className?: string; /** anillo de color continuo en vez de manchas sueltas: para contenedores grandes (la ventana completa) */ continuous?: boolean; /** segundos por vuelta */ lap?: number; /** 1 = el del panel; más = más denso */ density?: number; /** el halo difuminado (la capa con `blur`, la más cara de repintar): se quita en la ventana completa por fluidez */ halo?: boolean }) {
  const reduce = useReducedMotion()
  if (reduce) {
    return <span aria-hidden className={`pointer-events-none absolute inset-0 ${className ?? ""}`} style={{ boxShadow: `inset 0 0 18px 2px color-mix(in oklab, ${BLUE} 35%, transparent)` }} />
  }
  return (
    <div aria-hidden data-flow-beam className={className}>
      <style>{buildStyle(lap, density, continuous)}</style>
      {halo && <span />}
    </div>
  )
}
