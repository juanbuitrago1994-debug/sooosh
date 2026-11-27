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
  /** en qué momento de la animación (0 = inicio, 1 = final) está el máximo de color */
  colorPeak: number
  /** cuánto dura el color alrededor de ese momento: más bajo = más breve */
  colorWidth: number
  /** curvatura global de toda la pantalla (como un cristal curvo): 0 = ninguna */
  curve: number
  /** resolución del lienzo mientras se anima (1 = completa). Más bajo = más fluido; al final se pasa a resolución completa */
  renderScale: number
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

/** Valores por defecto (ronda 3, 27-nov-2026): 0,9 s; lupa más suave que la ronda 2; color MUY ligero y breve, al comienzo; curvatura global suave; lienzo al 60 % de resolución mientras se anima. */
export const DEFAULT_LENS: LensParams = {
  durationMs: 900,
  easePower: 1.3,
  radius: 0.45,
  widthFactor: 2.2,
  strength: 0.4,
  dispersion: 0.2,
  prism: 0.016,
  blur: 0.07,
  rim: 0.5,
  colorPeak: 0.3,
  colorWidth: 0.1,
  curve: 0.12,
  renderScale: 0.6,
  plateau: 1.5,
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
  colorPeak: [0, 1, 0.01, "Momento del color (0 = inicio)"],
  colorWidth: [0.04, 0.6, 0.01, "Duración del color"],
  curve: [0, 0.6, 0.01, "Curvatura global"],
  renderScale: [0.3, 1, 0.05, "Resolución al animar"],
  plateau: [1, 4, 0.1, "Duración del pico"],
  band: [0.02, 0.5, 0.01, "Suavidad de aparición"],
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Aceleración y frenado con la potencia `n` (1 = lineal). Con n = 2,2 arranca y frena con más ímpetu que el seno de la primera versión. */
export function easeInOutPower(t: number, n: number): number {
  const x = clamp01(t)
  return x < 0.5 ? 0.5 * Math.pow(2 * x, n) : 1 - 0.5 * Math.pow(2 * (1 - x), n)
}

export type LensFrame = { lensY: number; bulge: number; /** intensidad del color (prisma), de 0 a 1: más breve que `bulge` y concentrada al comienzo */ color: number }

/** Dónde está la lente y cuánto abomba en el avance `p`: el efecto sube hasta su pico a media pasada y se relaja en los extremos, para que al terminar la imagen sea idéntica a la página real. */
export function lensFrame(p: number, params: LensParams = DEFAULT_LENS): LensFrame {
  const t = clamp01(p)
  const z = (t - params.colorPeak) / params.colorWidth
  return { lensY: params.startY + (params.endY - params.startY) * easeInOutPower(t, params.easePower), bulge: Math.min(1, Math.sin(Math.PI * t) * params.plateau), color: Math.exp(-z * z) }
}
