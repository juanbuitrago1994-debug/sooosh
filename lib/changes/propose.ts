import { computeFit, type FitResult } from "@/lib/analysis/fit"
import { skillsIn } from "@/lib/analysis/offer-profile"
import { DIMENSIONS } from "@/lib/analysis/rubric"
import type { MatchResult } from "@/lib/match/types"
import { applyDecisions, type ChangeType, type Impact, type RewriteItem } from "@/lib/rewrite/groups"
import { proposeExtras } from "@/lib/rewrite/extras"
import { SECTION_KEYS, type CV } from "@/lib/schemas/cv"
import type { Offer } from "@/lib/schemas/offer"
import { typeBias } from "./bias"

/**
 * Cambios atómicos (Fase K5). Cada cambio tiene tipo, criterio de la rúbrica que mejora, motivo, evidencia LITERAL del CV, riesgo y
 * efecto estimado (se aplica solo ese cambio y se recalcula la ficha con el mismo motor de K4). Los estructurales (reordenar, titular)
 * y las brechas no necesitan modelo y NUNCA añaden contenido que el CV no tenga: reordenan, o piden a la persona que lo aporte.
 */
const L = (x: string[], n = 3) => x.slice(0, n).join(", ")

/** Marca los cambios que ya existían (reescritura con modelo, quitar, añadir habilidad) con su tipo y criterio. */
export function tagItems(items: RewriteItem[]): RewriteItem[] {
  return items.map((it) => {
    if (it.type) return it
    if (it.id === "summary") return { ...it, type: "resumen", criterion: "resumen-claves" }
    if (it.kind === "quitar") return { ...it, type: "quitar-relleno", criterion: "logro-longitud" }
    if (it.kind === "añadir") return { ...it, type: "habilidad", criterion: "herr-cobertura" }
    return { ...it, type: "viñeta", criterion: "tec-contexto" }
  })
}

const stableSortBy = <T>(xs: T[], weight: (x: T) => number): number[] => xs.map((_, i) => i).sort((a, b) => weight(xs[b]) - weight(xs[a]) || a - b)
const sameOrder = (order: number[]) => order.every((v, i) => v === i)

export function proposeStructural(cv: CV, offer: Offer, fit: FitResult): RewriteItem[] {
  const out: RewriteItem[] = []
  const weightOf = new Map(fit.offerProfile.terms.filter((t) => t.canonical && t.necessity !== "contexto").map((t) => [t.canonical!, t.weight]))
  const textWeight = (text: string) => skillsIn(text).reduce((a, s) => a + (weightOf.get(s.id) ?? 0), 0)

  // 1) Habilidades: lo que la oferta pide, primero (no cambia ni añade ninguna).
  cv.skills.forEach((g, gi) => {
    const order = stableSortBy(g.items, textWeight)
    if (sameOrder(order) || g.items.length < 3) return
    const moved = order.filter((o, pos) => o !== pos && textWeight(g.items[o]) > 0).map((o) => g.items[o])
    out.push({
      id: `reorder.skills.${gi}`, label: g.category ? `Habilidades · ${g.category}` : "Habilidades", original: g.items.join(" · "), proposed: order.map((o) => g.items[o]).join(" · "),
      status: "changed", kind: "cambiar", section: "Habilidades", type: "reordenar-habilidades", criterion: "tec-ubicacion", risk: "bajo",
      reason: `Pone primero lo que pide la oferta (${L(moved)}) para que se vea en la primera lectura. No añade ni quita ninguna habilidad.`,
      evidence: moved.slice(0, 3), op: { type: "reorder-skills", group: gi, order },
    })
  })

  // 2) Viñetas: en los puestos más recientes, las que demuestran lo que pide la oferta, primero.
  cv.experience.slice(0, 3).forEach((e, i) => {
    if (e.bullets.length < 3) return
    const order = stableSortBy(e.bullets, textWeight)
    if (sameOrder(order) || textWeight(e.bullets[order[0]]) <= textWeight(e.bullets[0])) return
    out.push({
      id: `reorder.bullets.${i}`, label: `${e.role} · ${e.company}`, original: e.bullets.map((b, k) => `${k + 1}. ${b}`).join("\n"), proposed: order.map((o, k) => `${k + 1}. ${e.bullets[o]}`).join("\n"),
      status: "changed", kind: "cambiar", section: "Experiencia", type: "reordenar-viñetas", criterion: "tec-ubicacion", risk: "bajo",
      reason: "Sube la viñeta que mejor demuestra lo que pide la oferta: quien lee suele fijarse solo en las primeras. El texto no cambia.",
      evidence: [e.bullets[order[0]]], op: { type: "reorder-bullets", exp: i, order },
    })
  })

  // 3) Secciones: perfiles con poca experiencia ponen la educación primero; en ofertas muy técnicas, las habilidades arriba.
  const current = (cv.sectionOrder?.length ? [...new Set([...cv.sectionOrder, ...SECTION_KEYS])] : [...SECTION_KEYS]) as string[]
  const has = (k: string) => (k === "summary" ? !!cv.summary?.trim() : k === "experience" ? cv.experience.length > 0 : k === "education" ? cv.education.length > 0 : k === "skills" ? cv.skills.some((g) => g.items.length) : k === "languages" ? cv.languages.length > 0 : cv.projects.length > 0)
  let target = [...current]
  const move = (k: string, before: string) => {
    target = target.filter((x) => x !== k)
    target.splice(Math.max(0, target.indexOf(before)), 0, k)
  }
  const years = fit.cvProfile.totalYears
  let why = ""
  let evidence: string | null = null
  if ((years === null || years < 2) && has("education") && has("experience") && current.indexOf("education") > current.indexOf("experience")) {
    move("education", "experience")
    why = "Con menos de 2 años de experiencia, la educación suele ser lo más fuerte: va antes de la experiencia."
    evidence = cv.education[0].degree || cv.education[0].institution
  } else if (has("skills") && fit.offerProfile.terms.filter((t) => t.necessity === "obligatorio" && (t.category === "herramienta" || t.category === "tecnica") && t.canonical).length >= 4 && current.indexOf("skills") > current.indexOf("experience")) {
    move("skills", "experience")
    why = "La oferta pide varias herramientas y conocimientos técnicos: las habilidades van antes de la experiencia para que se vean primero."
    evidence = cv.skills[0].items[0] ?? null
  }
  if (why && target.join() !== current.join()) {
    out.push({
      id: "reorder.sections", label: "Orden de las secciones", original: current.filter(has).join(" → "), proposed: target.filter(has).join(" → "),
      status: "changed", kind: "cambiar", section: "Estructura", type: "reordenar-secciones", criterion: "est-secciones", risk: "bajo", reason: why, evidence: evidence ? [evidence] : [],
      op: { type: "reorder-sections", order: target },
    })
  }

  // 4) Titular: si falta, el último puesto (literal); si existe y no muestra lo que pide la oferta, se completa SOLO con habilidades de la propia lista.
  const latest = cv.experience[0]?.role
  const top = fit.coverage.filter((c) => c.status === "cubierto" && c.term.canonical && c.term.necessity === "obligatorio").slice(0, 3)
  const mine = cv.skills.flatMap((g) => g.items)
  const fromList = top.map((c) => mine.find((it) => skillsIn(it).some((s) => s.id === c.term.canonical))).filter((x): x is string => !!x)
  const base = cv.header.headline?.trim() || latest
  if (base) {
    const have = new Set(skillsIn(base).map((s) => s.id))
    const extra = fromList.filter((it) => !skillsIn(it).some((s) => have.has(s.id))).slice(0, 3)
    const proposed = [base, ...(extra.length ? [extra.join(" · ")] : [])].join(" | ")
    if (proposed !== (cv.header.headline ?? "")) {
      out.push({
        id: "headline", label: "Titular", original: cv.header.headline ?? "", proposed, status: "changed", kind: "cambiar", section: "Titular", type: "titular", criterion: "titular-alinea", op: { type: "headline" },
        risk: extra.length ? "medio" : "bajo", evidence: [base, ...extra],
        reason: cv.header.headline?.trim() ? `Completa el titular con lo que más pide la oferta y tu CV ya demuestra (${L(extra)}).` : "El CV no tiene titular: se usa tu último puesto, tal como lo escribiste.",
      })
    }
  }
  void offer
  return out
}

/** Brechas: lo que la oferta pide como obligatorio y el CV no dice. NUNCA se rellenan solas: la persona decide si tiene esa experiencia. */
export function proposeGaps(fit: FitResult): RewriteItem[] {
  return fit.coverage
    .filter((c) => c.status === "ausente" && c.term.canonical && c.term.necessity === "obligatorio" && ["herramienta", "tecnica", "certificacion"].includes(c.term.category))
    .slice(0, 5)
    .map((c) => ({
      id: `gap.${c.term.id}`, label: `Falta: ${c.term.label}`, original: "", proposed: "", status: "changed" as const, kind: "añadir" as const, section: "Habilidades", type: "brecha" as const,
      criterion: c.term.category === "herramienta" ? "herr-cobertura" : "tec-cobertura", risk: "bajo" as const, userProvided: true, evidence: [],
      reason: `La oferta pide «${c.term.atsPhrase}» y tu CV no lo menciona.`,
      question: `¿Tienes experiencia real con ${c.term.label}? Si es así, escríbelo como lo usaste; si no, déjalo fuera (no lo agregamos por ti).`,
    }))
}

const labelOf = new Map<string, string>(DIMENSIONS.map((d) => [d.id as string, d.label]))
export const dimensionLabel = (id: string) => labelOf.get(id) ?? id

/** Aplica SOLO este cambio y recalcula la ficha: efecto en el global y en las dimensiones que más se mueven. */
export function impactOf(cv: CV, offer: Offer, item: RewriteItem, before: FitResult, opts: { now?: Date; rawOfferText?: string } = {}): Impact {
  const edited = item.type === "brecha" ? item.label.replace(/^Falta:\s*/, "") : undefined
  const after = computeFit(applyDecisions(cv, [item], { [item.id]: { status: "accepted", edited } }), offer, { now: opts.now, rawOfferText: opts.rawOfferText })
  const dims = after.scorecard.dimensions
    .map((d) => ({ id: d.id as string, delta: d.score - (before.scorecard.dimensions.find((b) => b.id === d.id)?.score ?? 0) }))
    .filter((d) => d.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)
  return { overall: after.overall - before.overall, dimensions: dims, ...(item.type === "brecha" ? { hypothetical: true } : {}) }
}

/** Conjunto completo de cambios para revisar: los existentes + estructurales + brechas, con efecto y prioridad según lo aprendido. */
export function buildChangeSet(cv: CV, offer: Offer, existing: RewriteItem[], opts: { now?: Date; rawOfferText?: string; match?: MatchResult | null; history?: { ref: string; decision: string }[] } = {}) {
  const before = computeFit(cv, offer, { match: opts.match ?? undefined, now: opts.now, rawOfferText: opts.rawOfferText })
  const own = existing.some((i) => i.kind === "añadir" || i.kind === "quitar") ? existing : [...existing, ...proposeExtras(cv, opts.match ?? null)]
  const bias = typeBias(opts.history ?? [])
  const all = tagItems([...own, ...proposeStructural(cv, offer, before), ...proposeGaps(before)])
  const items = all.map((it) => {
    const changed = it.status === "changed"
    return { ...it, priority: bias[it.type as ChangeType] === "baja" ? ("baja" as const) : ("normal" as const), ...(changed ? { impact: impactOf(cv, offer, it, before, opts) } : {}) }
  })
  items.sort((a, b) => Number(a.priority === "baja") - Number(b.priority === "baja") || (b.impact?.overall ?? 0) - (a.impact?.overall ?? 0))
  return { items, before }
}
