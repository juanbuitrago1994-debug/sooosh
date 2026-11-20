import { impactOf } from "@/lib/changes/propose"
import { computeFit } from "@/lib/analysis/fit"
import { lengthViolation, verifyNoInvention } from "@/lib/rewrite/verify"
import type { RewriteItem } from "@/lib/rewrite/groups"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"

/**
 * Ciclo de calidad de las propuestas del modelo (Fase K6): generar → verificar → volver a puntuar → regenerar SOLO lo débil.
 * «Débil» = una propuesta de texto (resumen o viñeta) cuyo efecto recalculado en la ficha no mejora nada (≤ 0). Máximo 2 rondas.
 * Corre ANTES de que la persona revise (así no se le piden decisiones sobre cambios que no sirven) y nunca toca lo que ya aceptó.
 * Una propuesta que sigue sin ayudar se conserva con prioridad baja; si empeora la ficha, se descarta.
 */
export const MAX_ROUNDS = 2
export type Regenerate = (item: RewriteItem, feedback: string[]) => Promise<string | null>

const isWeakCandidate = (it: RewriteItem) => it.status === "changed" && !it.op && it.kind === "cambiar" && (it.type === "resumen" || it.type === "viñeta")

export type ImproveReport = { weakBefore: number; weakAfter: number; regenerated: number; improved: number; dropped: number; rounds: number }

export async function improveWeak(args: { cv: CV; offer: Offer; items: RewriteItem[]; source: string; regenerate: Regenerate; now?: Date; rawOfferText?: string; rounds?: number }): Promise<{ items: RewriteItem[]; report: ImproveReport }> {
  const { cv, offer, source } = args
  const opts = { now: args.now, rawOfferText: args.rawOfferText }
  const before = computeFit(cv, offer, opts)
  let items = args.items.map((it) => (isWeakCandidate(it) ? { ...it, impact: it.impact ?? impactOf(cv, offer, it, before, opts) } : it))
  const weak = () => items.filter((it) => isWeakCandidate(it) && (it.impact?.overall ?? 0) <= 0)
  const report: ImproveReport = { weakBefore: weak().length, weakAfter: 0, regenerated: 0, improved: 0, dropped: 0, rounds: 0 }

  for (let round = 1; round <= (args.rounds ?? MAX_ROUNDS) && weak().length; round++) {
    report.rounds = round
    for (const w of weak()) {
      const feedback = [`El intento anterior no mejoró la ficha del CV frente a esta oferta (criterio: ${w.criterion ?? "general"}). Usa el vocabulario de la oferta SOLO donde describa exactamente lo mismo que ya dice el texto; sin añadir nada.`]
      report.regenerated++
      let candidate: string | null = null
      try {
        candidate = await args.regenerate(w, feedback)
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e
      }
      if (!candidate || candidate.replace(/\s+/g, " ") === w.original.replace(/\s+/g, " ")) continue
      // La candidata pasa por el mismo verificador que cualquier propuesta.
      const v = [...verifyNoInvention(source, candidate, { offer }).violations, ...[lengthViolation(w.original, candidate)].filter((x): x is NonNullable<typeof x> => !!x)]
      if (v.length) continue
      const next: RewriteItem = { ...w, proposed: candidate }
      const impact = impactOf(cv, offer, next, before, opts)
      if (impact.overall > (w.impact?.overall ?? 0)) {
        items = items.map((it) => (it.id === w.id ? { ...next, impact } : it))
        if (impact.overall > 0) report.improved++
      }
    }
  }

  // Lo que sigue sin ayudar: si empeora la ficha se descarta; si es neutro se conserva al final de la lista.
  items = items.map((it) => {
    if (!isWeakCandidate(it) || (it.impact?.overall ?? 0) > 0) return it
    if ((it.impact?.overall ?? 0) < 0) {
      report.dropped++
      return { ...it, status: "unchanged" as const, proposed: it.original, reason: undefined }
    }
    return { ...it, priority: "baja" as const }
  })
  report.weakAfter = items.filter((it) => isWeakCandidate(it) && (it.impact?.overall ?? 0) <= 0).length
  return { items, report }
}
