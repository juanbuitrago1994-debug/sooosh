import type { ChangeType } from "@/lib/rewrite/groups"

/** Tipo de cambio a partir de la `ref` guardada en la memoria de preferencias (el prefijo del id del cambio). */
export function typeOfRef(ref: string): ChangeType {
  if (ref === "summary") return "resumen"
  if (ref.startsWith("rm.")) return "quitar-relleno"
  if (ref.startsWith("add.skill")) return "habilidad"
  if (ref.startsWith("reorder.skills")) return "reordenar-habilidades"
  if (ref.startsWith("reorder.bullets")) return "reordenar-viñetas"
  if (ref.startsWith("reorder.sections")) return "reordenar-secciones"
  if (ref === "headline") return "titular"
  if (ref.startsWith("gap.")) return "brecha"
  return "viñeta"
}

/**
 * Memoria de preferencias por TIPO de cambio: si la persona rechazó un tipo al menos 3 veces y nunca lo aceptó, ese tipo pasa a
 * prioridad baja (se muestra al final, nunca se oculta). No es entrenamiento del modelo: es una regla simple y visible.
 */
export const BIAS_MIN_REJECTIONS = 3
export function typeBias(history: { ref: string; decision: string }[]): Partial<Record<ChangeType, "baja">> {
  const stats = new Map<ChangeType, { rejected: number; accepted: number }>()
  for (const h of history) {
    const t = typeOfRef(h.ref)
    const s = stats.get(t) ?? { rejected: 0, accepted: 0 }
    if (h.decision === "rechazado") s.rejected++
    else s.accepted++
    stats.set(t, s)
  }
  const out: Partial<Record<ChangeType, "baja">> = {}
  for (const [t, s] of stats) if (s.rejected >= BIAS_MIN_REJECTIONS && s.accepted === 0) out[t] = "baja"
  return out
}
