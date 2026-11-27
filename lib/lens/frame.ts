/**
 * Línea de tiempo y parámetros del efecto lupa del login. Funciones puras (sin WebGL) para poder probarlas: dado el avance `p` (0 → 1) devuelven dónde está la lente y cuánto
 * abomba. Coordenadas de la textura: `y` de 0 (abajo) a 1 (arriba), como en el shader.
 */
export type LensParams = {
  /** duración total, en milisegundos */
  durationMs: number
  /** curva de velocidad: 1 = lineal; 2–3 = arranca y frena con más ímpetu */
  easePower: number
  /** tamaño de la lente (relativo a la altura de la pantalla) */
  radius: number
  /** lente ancha: 1 = círculo; 3 = una banda que abarca casi todo el ancho (como en las referencias) */
  widthFactor: number
  /** 1 = sin lupa; 0,5 ≈ ×2; 0,2 ≈ ×5. Más bajo = más fuerza */
  strength: number
  /** prisma lateral: separa rojo, verde y azul con distinto aumento (franjas de color a los lados) */
  dispersion: number
  /** prisma vertical: desplaza los canales de color hacia arriba y abajo (azul arriba, naranja abajo) */
  prism: number
  /** estela vertical: longitud del desenfoque direccional (en alto de pantalla) */
  blur: number
  /** 0 = la fuerza es mayor en el centro de la lente; 1 = mayor en su borde (donde se ve el color) */
  rim: number
  /** cuánto dura el pico del efecto: 1 = un instante; 3 = se mantiene más tiempo fuerte */
  plateau: number
  /** suavidad con la que aparecen los elementos al pasar la lente */
  band: number
  /** la lente empieza por encima de la pantalla y termina por debajo */
  startY: number
  endY: number
  /** posición horizontal de la lente (centro de la columna del login) */
  x: number
}

/** Valores por defecto: más rápido y fuerte que la primera versión (2 s, círculo, sin color), con prisma, estela y lente ancha (referencias de Juan, 27-nov-2026). */
export const DEFAULT_LENS: LensParams = {
  durationMs: 1200,
  easePower: 1.8,
  radius: 0.5,
  widthFactor: 2.4,
  strength: 0.22,
  dispersion: 0.4,
  prism: 0.04,
  blur: 0.1,
  rim: 0.55,
  plateau: 1.8,
  band: 0.2,
  startY: 1.0,
  endY: -0.15,
  x: 0.5,
}

/** Rangos para el panel de ajuste (`?afinar=1`): [mínimo, máximo, paso, etiqueta]. */
export const LENS_RANGES: Record<Exclude<keyof LensParams, "startY" | "endY" | "x">, [number, number, number, string]> = {
  durationMs: [400, 3000, 50, "Duración (ms)"],
  easePower: [1, 4, 0.1, "Ímpetu de la curva"],
  radius: [0.1, 1, 0.01, "Tamaño de la lente"],
  widthFactor: [1, 5, 0.1, "Ancho de la lente"],
  strength: [0.05, 1, 0.01, "Fuerza de la lupa (menos = más)"],
  dispersion: [0, 1, 0.01, "Color del prisma (laterales)"],
  prism: [0, 0.15, 0.005, "Color vertical (arriba y abajo)"],
  blur: [0, 0.4, 0.01, "Estela vertical"],
  rim: [0, 1, 0.01, "Fuerza en el borde"],
  plateau: [1, 4, 0.1, "Duración del pico"],
  band: [0.02, 0.5, 0.01, "Suavidad de aparición"],
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Aceleración y frenado con la potencia `n` (1 = lineal). Con n = 2,2 arranca y frena con más ímpetu que el seno de la primera versión. */
export function easeInOutPower(t: number, n: number): number {
  const x = clamp01(t)
  return x < 0.5 ? 0.5 * Math.pow(2 * x, n) : 1 - 0.5 * Math.pow(2 * (1 - x), n)
}

export type LensFrame = { lensY: number; bulge: number }

/** Dónde está la lente y cuánto abomba en el avance `p`: el efecto sube hasta su pico a media pasada y se relaja en los extremos, para que al terminar la imagen sea idéntica a la página real. */
export function lensFrame(p: number, params: LensParams = DEFAULT_LENS): LensFrame {
  const t = clamp01(p)
  return { lensY: params.startY + (params.endY - params.startY) * easeInOutPower(t, params.easePower), bulge: Math.min(1, Math.sin(Math.PI * t) * params.plateau) }
}
