import { computeFit, fitDelta, type FitResult } from "@/lib/analysis/fit"
import { cvCorpus, verifyNoInvention, type Violation } from "@/lib/rewrite/verify"
import { applyDecisions, type Decisions, type RewriteItem } from "@/lib/rewrite/groups"
import type { CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"

/**
 * Reconstrucción del CV final (Fase K6): parte del CV original y aplica SOLO lo que la persona aceptó (con sus ediciones).
 * Antes y después hace tres comprobaciones deterministas:
 *  1. cada texto que escribió el MODELO se verifica contra la fuente (texto original + lo que la persona escribió); si no pasa, se
 *     excluye del resultado y se avisa (nunca se aplica en silencio);
 *  2. integridad: empresas, puestos, fechas, instituciones, títulos y datos de contacto no cambian;
 *  3. verificación del CV COMPLETO contra la fuente (cifras, fechas, nombres y términos de la oferta que el CV no dice).
 * Lo que la persona escribe a mano (ediciones y respuestas a brechas) es suyo: se permite y se marca como «escrito por ti».
 */
export type Outcome = "aceptado" | "editado" | "rechazado" | "pendiente" | "bloqueado"
export type ChangeLine = { id: string; label: string; type: string; outcome: Outcome; reason?: string }
export type IntegrityIssue = { field: string; original: string; final: string }

export type RebuildReport = {
  changes: ChangeLine[]
  counts: Record<Outcome, number>
  fitBefore: FitResult
  fitAfter: FitResult
  delta: ReturnType<typeof fitDelta>
  /** Textos del modelo que no pasaron la verificación y se dejaron fuera. */
  blocked: { id: string; violations: Violation[] }[]
  integrity: IntegrityIssue[]
  /** Hallazgos de la verificación del CV completo (vacío = no se detectó nada inventado). */
  verification: Violation[]
  /** Textos que la persona escribió o editó (se señalan, no se bloquean). */
  writtenByUser: string[]
  ok: boolean
}

const isUserText = (it: RewriteItem, d: Decisions[string] | undefined) => !!d?.edited?.trim() || (!!it.userProvided && d?.status === "accepted")

/** Campos que ningún cambio aceptado puede tocar. Devuelve lo que no coincide. */
export function checkIntegrity(original: CV, final: CV): IntegrityIssue[] {
  const out: IntegrityIssue[] = []
  const cmp = (field: string, a: unknown, b: unknown) => {
    const x = JSON.stringify(a ?? null)
    const y = JSON.stringify(b ?? null)
    if (x !== y) out.push({ field, original: x, final: y })
  }
  const { headline: _h1, ...h1 } = original.header
  const { headline: _h2, ...h2 } = final.header
  void _h1
  void _h2
  cmp("contacto", h1, h2)
  cmp("número de puestos", original.experience.length, final.experience.length)
  original.experience.forEach((e, i) => {
    const f = final.experience[i]
    cmp(`puesto ${i + 1}`, [e.company, e.role, e.location, e.startDate, e.endDate], [f?.company, f?.role, f?.location, f?.startDate, f?.endDate])
  })
  cmp("educación", original.education, final.education)
  cmp("idiomas", original.languages, final.languages)
  cmp("proyectos (datos)", original.projects.map((p) => [p.name, p.url, p.technologies]), final.projects.map((p) => [p.name, p.url, p.technologies]))
  return out
}

export function rebuildCv(args: { cv: CV; offer: Offer; items: RewriteItem[]; decisions: Decisions; /** texto fuente original (archivo leído + CV leído) */ source: string; now?: Date; rawOfferText?: string }): { cv: CV; report: RebuildReport } {
  const { cv, offer, items, decisions, source } = args
  const userTexts = items.filter((it) => isUserText(it, decisions[it.id])).map((it) => (decisions[it.id]?.edited ?? it.proposed).trim()).filter(Boolean)
  const guard = [source, ...userTexts].join("\n")

  // 1) lo escrito por el modelo se verifica; si no pasa, queda fuera
  const effective: Decisions = { ...decisions }
  const blocked: RebuildReport["blocked"] = []
  const lines: ChangeLine[] = items.map((it) => {
    const d = decisions[it.id]
    const base = { id: it.id, label: it.label, type: it.type ?? "cambio" }
    if (it.status !== "changed") return { ...base, outcome: "pendiente" as const, reason: "El modelo no propuso un cambio válido." }
    if (!d || d.status === "pending") return { ...base, outcome: "pendiente" as const }
    if (d.status === "rejected") return { ...base, outcome: "rechazado" as const }
    if (isUserText(it, d)) return { ...base, outcome: "editado" as const }
    const modelText = !it.op && it.kind !== "quitar" && !!it.proposed.trim()
    if (modelText) {
      const v = verifyNoInvention(guard, it.proposed, { offer })
      if (!v.ok) {
        effective[it.id] = { status: "rejected" }
        blocked.push({ id: it.id, violations: v.violations })
        return { ...base, outcome: "bloqueado" as const, reason: v.violations.map((x) => x.message).join(" ") }
      }
    }
    return { ...base, outcome: "aceptado" as const }
  })

  const final = applyDecisions(cv, items, effective)

  // 2) integridad  3) verificación del CV completo (sin el orden de secciones, que no es texto del CV)
  const integrity = checkIntegrity(cv, final)
  const { sectionOrder: _so, ...finalText } = final
  void _so
  const verification = verifyNoInvention(guard, cvCorpus(finalText as CV), { offer }).violations

  const fitBefore = computeFit(cv, offer, { now: args.now, rawOfferText: args.rawOfferText })
  const fitAfter = computeFit(final, offer, { now: args.now, rawOfferText: args.rawOfferText })
  const counts: Record<Outcome, number> = { aceptado: 0, editado: 0, rechazado: 0, pendiente: 0, bloqueado: 0 }
  for (const l of lines) counts[l.outcome]++

  return {
    cv: final,
    report: { changes: lines, counts, fitBefore, fitAfter, delta: fitDelta(fitBefore, fitAfter), blocked, integrity, verification, writtenByUser: userTexts, ok: integrity.length === 0 && verification.length === 0 && blocked.length === 0 },
  }
}
