import { STAGES } from "./stages"

/**
 * Porcentaje de la lectura del CV. El servidor avisa en qué etapa va (`STAGES`, 6 etapas) pero no cuánto lleva dentro de ella, así que el
 * porcentaje es HONESTO por construcción: el piso es lo completado (etapas terminadas ÷ total) y dentro de la etapa actual avanza suave hacia
 * el techo de la siguiente sin alcanzarlo. Nunca marca 100 %: eso solo pasa cuando termina de verdad (el panel se cierra al llegar el resultado).
 * Las etapas pesan igual: es una aproximación (un PDF escaneado pasa más tiempo en la primera), no una medición.
 */
const N = STAGES.length
/** Cuánto antes del techo de la etapa se detiene la animación dentro de ella (puntos porcentuales). */
const HEADROOM = 2

/** Índice de la etapa a partir de su etiqueta; -1 si aún no llegó ninguna (la subida del archivo). */
export const stageIndex = (label: string | undefined): number => (label ? STAGES.findIndex((s) => s === label) : -1)

/** Piso del porcentaje en la etapa `i` (0 mientras se sube el archivo). */
export const stageFloor = (i: number): number => (i < 0 ? 0 : Math.round((i / N) * 100))
/** Techo (sin alcanzar) del porcentaje mientras dura la etapa `i`. */
export const stageCeiling = (i: number): number => Math.max(stageFloor(i), Math.round(((Math.max(i, 0) + 1) / N) * 100) - HEADROOM)

/** Siguiente valor mostrado: nunca baja de lo ya completado, se acerca al techo de la etapa de forma asintótica y nunca llega a 100. */
export function nextProgress(current: number, i: number, rate = 0.06): number {
  const floor = stageFloor(i)
  const ceil = Math.min(99, stageCeiling(i))
  const base = Math.max(current, floor)
  return Math.min(ceil, base + (ceil - base) * rate)
}
