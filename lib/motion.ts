/**
 * Constantes de movimiento de TODA la app (docs/DESIGN-PATTERNS.md §5).
 * Solo se anima opacity, blur y translate. Nunca scale: ningún texto crece ni se encoge.
 * Principio: lento, suave y casi imperceptible; el movimiento responde a una acción o a un avance real.
 */
export const MOTION = {
  /** entradas, en segundos */
  enter: 0.5,
  /** salidas, en segundos (más cortas que las entradas) */
  exit: 0.28,
  ease: [0.22, 1, 0.36, 1] as const,
  /** resorte suave para posiciones (relleno de pasos) */
  spring: { type: "spring", stiffness: 140, damping: 22, mass: 1 } as const,
  /** desplazamiento vertical de entrada/salida, en px */
  offset: 10,
  /** desenfoque de entrada/salida, en px */
  blur: 6,
  /** el contenido en espera mientras la IA trabaja: casi nítido y algo atenuado */
  waitBlur: 2,
  waitOpacity: 0.55,
  /** retardo entre palabras del mensaje de estado, en segundos */
  wordStagger: 0.045,
  /** ciclo de la onda de opacidad ("respiración") del mensaje, en segundos, y desfase entre palabras */
  wave: 2.6,
  waveDelay: 0.14,
  /** matriz de puntos: un ciclo de pulso por punto, retardo entre puntos y opacidad mínima/máxima */
  dotCycle: 1.8,
  dotStagger: 0.09,
  dotMin: 0.15,
  dotMax: 0.9,
  /** cargador de puntos de transitions.dev (P33): ciclo en segundos y opacidad base/activa de cada punto; el punto está «activo» entre el 0 % y el 45 % del ciclo con el pico al 15 % */
  loaderCycle: 1.2,
  loaderBase: 0.2,
  loaderActive: 0.65,
  /** una deriva completa del aura ambiental, en segundos */
  drift: 16,
} as const

export const TRANSITION_IN = { duration: MOTION.enter, ease: MOTION.ease }
export const TRANSITION_OUT = { duration: MOTION.exit, ease: MOTION.ease }
