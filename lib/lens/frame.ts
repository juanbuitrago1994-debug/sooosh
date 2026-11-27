/**
 * Línea de tiempo del efecto lupa del login. Funciones puras (sin WebGL) para poder probarlas: dado el avance `p` (0 → 1) devuelven dónde está la lente y cuánto abomba.
 * Coordenadas de la textura: `y` de 0 (abajo) a 1 (arriba), como en el shader.
 */
export const LENS = {
  /** duración total del efecto, en milisegundos */
  durationMs: 2000,
  /** radio de la lente (relativo a la altura de la pantalla) */
  radius: 0.3,
  /** < 1 = lupa que AGRANDA el centro (0,5 ≈ ×2); 1 = sin efecto */
  strength: 0.5,
  /** ancho (en alto de pantalla) del borde con el que aparecen los elementos al pasar la lente */
  band: 0.16,
  /** la lente empieza por encima del borde superior y termina por debajo del inferior */
  startY: 1.0,
  endY: -0.1,
  /** posición horizontal de la lente (centro de la columna del login) */
  x: 0.5,
} as const

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** Aceleración y frenado suaves (seno): la lente baja sin tirones ni rebotes. */
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * clamp01(t)) - 1) / 2

export type LensFrame = { lensY: number; bulge: number }

/** Dónde está la lente y cuánto abomba en el avance `p`: abomba a media pasada y se relaja en los extremos, para que al terminar la imagen sea idéntica a la página real. */
export function lensFrame(p: number): LensFrame {
  const t = clamp01(p)
  return { lensY: LENS.startY + (LENS.endY - LENS.startY) * easeInOutSine(t), bulge: Math.min(1, Math.sin(Math.PI * t) * 1.5) }
}
