"use client"

import { useCallback, useEffect, useId, useRef } from "react"
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react"
import { MOTION } from "@/lib/motion"

/**
 * Marca de Sooosh. El logo original (logoipsum-393) es un cuadrado redondeado con un «amanecer» recortado.
 * Para poder mover el amanecer por separado, el cuadrado se dibuja entero y el amanecer es un hueco (máscara) cuya
 * forma = silueta − las 7 piezas del logo original (relleno evenodd: las piezas están dentro de la silueta y no se solapan).
 * Color: `currentColor` (hereda del tema, sin colores literales).
 */
const SILHOUETTE =
  "M15.3817 0H24.6183C28.7807 0 30.862 0.000553668 32.5426 0.56108C35.7979 1.64713 38.3529 4.20208 39.4389 7.45739C39.9994 9.13798 40 11.2193 40 15.3817V24.6183C40 28.7807 39.9994 30.862 39.4389 32.5426C38.3529 35.7979 35.7979 38.3529 32.5426 39.4389C30.862 39.9994 28.7807 40 24.6183 40H15.3817C11.2193 40 9.13798 39.9994 7.45739 39.4389C4.20208 38.3529 1.64713 35.7979 0.56108 32.5426C0.000553668 30.862 0 28.7807 0 24.6183V15.3817C0 11.2193 0.000553668 9.13798 0.56108 7.45739C1.64713 4.20208 4.20208 1.64713 7.45739 0.56108C9.13798 0.000553668 11.2193 0 15.3817 0Z"

const PIECES = [
  "M16.6584 40H15.3817C12.0653 40 10.07 39.9994 8.54578 39.7159L17.3668 28.0344L16.6584 40Z",
  "M31.2482 39.7514C29.7502 39.9988 27.7875 40 24.6183 40H23.109L22.397 28.0309L31.2482 39.7514Z",
  "M39.6714 31.6708C39.607 31.9773 39.5312 32.2655 39.4388 32.5426C38.8336 34.3567 37.7711 35.9522 36.3866 37.1982L26.4399 26.044L39.6714 31.6708Z",
  "M3.4854 37.0792C2.16393 35.8511 1.14735 34.3 0.561036 32.5426C0.459507 32.2382 0.375209 31.921 0.307129 31.5803L13.3239 26.0458L3.4854 37.0792Z",
  "M40 24.6183C40 25.7428 39.9968 26.7154 39.9858 27.5692L28.1729 23.006H40V24.6183Z",
  "M11.5962 23.006L0.0106534 27.4805C0.000706105 26.6481 0 25.704 0 24.6183V23.006H11.5962Z",
  "M24.6183 0C28.7807 0 30.862 0.000553668 32.5426 0.56108C35.7979 1.64713 38.3529 4.20208 39.4389 7.45739C39.9994 9.13798 40 11.2193 40 15.3817V20.016H27.5089L36.5181 16.1861L33.8459 14.4123L25.1048 17.7876L29.2081 12.358L26.2571 11.5501L21.7259 16.6282L21.3885 10.9091H18.3825L18.0398 16.6282L13.5121 11.5501L10.5629 12.358L14.6609 17.7859L5.92507 14.4123L3.25284 16.1861L12.2603 20.016H0V15.3817C0 11.2193 0.000553668 9.13798 0.56108 7.45739C1.64713 4.20208 4.20208 1.64713 7.45739 0.56108C9.13798 0.000553668 11.2193 0 15.3817 0H24.6183Z",
]
const BURST = [SILHOUETTE, ...PIECES].join("")

/** Centro desde el que irradia el amanecer (coordenadas del viewBox 40×40). */
const HUB = { x: 20, y: 21.5 }

/**
 * El amanecer son 12 rayos. Ángulo de cada uno (grados, sentido horario desde la derecha, y hacia abajo) en el orden
 * en que se animan: empieza arriba y da la vuelta, así la onda recorre el logo en círculo.
 */
const RAYS = [270, 309, 338, 0, 22, 51, 90, 130, 158, 180, 202, 231] as const
const RAY_COUNT = RAYS.length

/**
 * Microinteracción «onda de rayos» (inspirada en la de transitions.dev): cada rayo se recoge hacia el centro y vuelve a salir,
 * uno tras otro en círculo. El amanecer NO gira: la sensación de giro la da el desfase entre rayos.
 * Un rayo mantiene su ancho y solo cambia de largo (como una línea que se retrae y vuelve a crecer).
 */
const WAVE = {
  /** duración del ciclo de un rayo (plegado + regrowth) y de su fase de plegado, en segundos */
  ray: 0.95,
  fold: 0.26,
  /** desfase entre un rayo y el siguiente, en segundos */
  stagger: 0.06,
  /** largo mínimo de un rayo (1 = completo) */
  minLength: 0.22,
} as const
const TOTAL = WAVE.ray + (RAY_COUNT - 1) * WAVE.stagger

/** Curva cúbica de Bézier (la misma resolución numérica del referente). */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const c = (a: number, b: number, t: number) => 3 * a * t * (1 - t) * (1 - t) + 3 * b * t * t * (1 - t) + t * t * t
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let lo = 0
    let hi = 1
    let m = 0
    for (let i = 0; i < 30; i++) {
      m = (lo + hi) / 2
      if (c(x1, x2, m) < x) lo = m
      else hi = m
    }
    return c(y1, y2, m)
  }
}
const GATHER = bezier(0.4, 0, 0.2, 1) // se recoge: sale de golpe y aterriza suave en el centro
const GROW = bezier(...MOTION.ease) // vuelve a salir: arranque rápido, asiento largo

/** Largo (0–1) del rayo `index` en el segundo `seconds` del ciclo; 1 antes de que le toque y al terminar. */
export function rayLength(seconds: number, index: number): number {
  const t = seconds - index * WAVE.stagger
  if (t <= 0 || t >= WAVE.ray) return 1
  if (t < WAVE.fold) return 1 - (1 - WAVE.minLength) * GATHER(t / WAVE.fold)
  return WAVE.minLength + (1 - WAVE.minLength) * GROW((t - WAVE.fold) / (WAVE.ray - WAVE.fold))
}
export const WAVE_SECONDS = TOTAL

const rad = (d: number) => (d * Math.PI) / 180
/** Cuña (clipPath) de cada rayo: de la mitad del ángulo con el rayo anterior a la mitad con el siguiente. */
function wedge(i: number): string {
  const prev = RAYS[(i - 1 + RAY_COUNT) % RAY_COUNT]
  const next = RAYS[(i + 1) % RAY_COUNT]
  const diff = (a: number, b: number) => ((b - a + 540) % 360) - 180 // diferencia con signo en (−180, 180]
  // Las cuñas se solapan 2° con las vecinas: sin solape, el borde antialias de dos cuñas contiguas dejaría una costura clara.
  const a0 = RAYS[i] + diff(RAYS[i], prev) / 2 + Math.sign(diff(RAYS[i], prev)) * 2
  const a1 = RAYS[i] + diff(RAYS[i], next) / 2 + Math.sign(diff(RAYS[i], next)) * 2
  const R = 60
  const pt = (d: number) => `${(HUB.x + R * Math.cos(rad(d))).toFixed(3)} ${(HUB.y + R * Math.sin(rad(d))).toFixed(3)}`
  return `M${HUB.x} ${HUB.y}L${pt(a0)}L${pt(RAYS[i])}L${pt(a1)}Z`
}
const WEDGES = RAYS.map((_, i) => wedge(i))

/**
 * Logo de Sooosh. Al pasar el puntero (o enfocar) los rayos del amanecer se recogen y vuelven a salir en onda; el cuadrado no se mueve.
 * Excepción documentada a «solo opacity/blur/translate»: este movimiento del logo lo pidió Juan (19-nov-2026).
 * Con «reducir movimiento» no se anima.
 */
export function Logo({ className, playTrigger }: { className?: string; /** cambia para disparar la animación desde fuera (p. ej. al pasar sobre toda la marca) */ playTrigger?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "")
  const reduce = useReducedMotion()
  const rays = useRef<(SVGGElement | null)[]>([])
  const clock = useMotionValue(0)
  const running = useRef(false)
  useMotionValueEvent(clock, "change", (sec) => {
    rays.current.forEach((g, i) => {
      const len = rayLength(sec, i)
      if (g) g.setAttribute("transform", len === 1 ? "" : `translate(${HUB.x} ${HUB.y}) rotate(${RAYS[i]}) scale(${len.toFixed(4)} 1) rotate(${-RAYS[i]}) translate(${-HUB.x} ${-HUB.y})`)
    })
  })

  const play = useCallback(() => {
    if (reduce || running.current) return
    running.current = true
    animate(clock, TOTAL, { duration: TOTAL, ease: "linear" }).then(() => {
      clock.jump(0)
      rays.current.forEach((g) => g?.removeAttribute("transform"))
      running.current = false
    })
  }, [reduce, clock])
  useEffect(() => {
    if (playTrigger) play()
  }, [playTrigger, play])

  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden className={className} onPointerEnter={play}>
      <defs>
        <path id={`${uid}-burst`} d={BURST} fillRule="evenodd" />
        {WEDGES.map((d, i) => (
          <clipPath key={i} id={`${uid}-w${i}`}>
            <path d={d} />
          </clipPath>
        ))}
        <mask id={`${uid}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="40">
          <rect width="40" height="40" fill="white" />
          {WEDGES.map((_, i) => (
            <g key={i} clipPath={`url(#${uid}-w${i})`} fill="black">
              <g ref={(el) => void (rays.current[i] = el)}>
                <use href={`#${uid}-burst`} />
              </g>
            </g>
          ))}
        </mask>
      </defs>
      <path d={SILHOUETTE} fill="currentColor" mask={`url(#${uid}-mask)`} />
    </svg>
  )
}
