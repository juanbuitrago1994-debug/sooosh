import { SECTION_KEYS, type CV } from "@/lib/schemas/cv"

export type ChangeKind = "cambiar" | "quitar" | "añadir"
export type Risk = "bajo" | "medio" | "alto"

/** Tipo de cambio (Fase K5): qué problema de la rúbrica ataca. `kind` sigue siendo cambiar/quitar/añadir para la memoria de preferencias. */
export const CHANGE_TYPES = ["resumen", "viñeta", "quitar-relleno", "habilidad", "reordenar-habilidades", "reordenar-viñetas", "reordenar-secciones", "titular", "brecha"] as const
export type ChangeType = (typeof CHANGE_TYPES)[number]

/** Operación estructural que no es «cambiar un texto»: reordena o fija el titular. Los índices son los del CV ORIGINAL. */
export type ChangeOp =
  | { type: "reorder-skills"; group: number; order: number[] }
  | { type: "reorder-bullets"; exp: number; order: number[] }
  | { type: "reorder-sections"; order: string[] }
  | { type: "headline" }

/** Efecto estimado de aplicar SOLO este cambio, con el mismo motor de fit (K4). */
export type Impact = { overall: number; dimensions: { id: string; delta: number }[]; hypothetical?: boolean }

/** Una propuesta de cambio sobre el CV: reformular un texto, quitar una viñeta o añadir una habilidad. */
export type RewriteItem = {
  /** "summary" · "exp.<i>.<j>" · "proj.<i>.<j>" (cambiar) · "rm.exp.<i>.<j>" / "rm.proj.<i>.<j>" (quitar) · "add.skill.<n>" (añadir) */
  id: string
  label: string
  original: string
  /** texto propuesto; vacío cuando se quita algo */
  proposed: string
  /** changed: hay propuesta válida · unchanged: el modelo no mejoró nada · kept: se descartó por inventar; se conserva el original */
  status: "changed" | "unchanged" | "kept"
  /** por qué se descartó (cuando status = kept) */
  reasons?: string[]
  kind?: ChangeKind
  section?: string
  /** por qué se propone este cambio, en una frase */
  reason?: string
  /** fragmentos EXACTOS del CV fuente que respaldan el cambio; sin evidencia no se propone */
  evidence?: string[]
  risk?: Risk
  /** K5: tipo, criterio de la rúbrica que mejora, efecto estimado, operación estructural y datos de brecha. */
  type?: ChangeType
  criterion?: string
  impact?: Impact
  op?: ChangeOp
  /** Brecha: pregunta opcional para la persona; solo ella puede aportar la respuesta (nunca se inventa). */
  question?: string
  userProvided?: boolean
  /** Según lo que la persona ha aceptado o rechazado antes de este tipo de cambio («baja» se muestra al final). */
  priority?: "normal" | "baja"
}

export type Decision = { status: "pending" | "accepted" | "rejected"; edited?: string }
export type Decisions = Record<string, Decision>

export type SourceItem = { id: string; label: string; text: string; section: string }

/** Un grupo se reescribe con una sola llamada al modelo: el resumen, o las viñetas de un puesto/proyecto. */
export function rewriteGroups(cv: CV): string[] {
  const g: string[] = []
  if (cv.summary?.trim()) g.push("summary")
  cv.experience.forEach((e, i) => e.bullets.length && g.push(`exp.${i}`))
  cv.projects.forEach((p, i) => p.bullets.length && g.push(`proj.${i}`))
  return g
}

export function groupLabel(cv: CV, group: string): string {
  if (group === "summary") return "Resumen"
  const [kind, i] = group.split(".")
  if (kind === "exp") return `${cv.experience[+i]?.role} · ${cv.experience[+i]?.company}`
  return `Proyecto ${cv.projects[+i]?.name}`
}

/** Contexto que se le da al modelo (puesto/empresa), solo como referencia. */
export function groupContext(cv: CV, group: string): string {
  const [kind, i] = group.split(".")
  if (kind === "exp") return `Puesto: ${cv.experience[+i]?.role}, ${cv.experience[+i]?.company}`
  if (kind === "proj") return `Proyecto: ${cv.projects[+i]?.name}`
  return "Resumen profesional"
}

export function groupItems(cv: CV, group: string): SourceItem[] {
  if (group === "summary") return cv.summary?.trim() ? [{ id: "summary", label: "Resumen", text: cv.summary, section: "Resumen" }] : []
  const [kind, idx] = group.split(".")
  const i = Number(idx)
  if (kind === "exp" && cv.experience[i]) {
    const e = cv.experience[i]
    return e.bullets.map((text, j) => ({ id: `exp.${i}.${j}`, label: `${e.role} · ${e.company} — viñeta ${j + 1}`, text, section: "Experiencia" }))
  }
  if (kind === "proj" && cv.projects[i]) {
    const p = cv.projects[i]
    return p.bullets.map((text, j) => ({ id: `proj.${i}.${j}`, label: `Proyecto ${p.name} — viñeta ${j + 1}`, text, section: "Proyectos" }))
  }
  return []
}

function setText(cv: CV, id: string, text: string) {
  if (id === "summary") {
    cv.summary = text
    return
  }
  const [kind, i, j] = id.split(".")
  const bullets = kind === "exp" ? cv.experience[+i]?.bullets : cv.projects[+i]?.bullets
  if (bullets && +j < bullets.length) bullets[+j] = text
}

/**
 * CV final: parte del original y SOLO aplica los cambios aceptados (con su edición, si la hay).
 * Lo pendiente, rechazado o descartado por el verificador queda tal como estaba.
 */
export function applyDecisions(cv: CV, items: RewriteItem[], decisions: Decisions): CV {
  const out = structuredClone(cv)
  const removals: { list: string[]; index: number }[] = []
  const ops: { op: ChangeOp; edited?: string; proposed: string }[] = []
  for (const it of items) {
    const d = decisions[it.id]
    if (it.status !== "changed" || d?.status !== "accepted") continue
    const text = (d.edited ?? it.proposed).trim()
    if (it.op) {
      ops.push({ op: it.op, edited: d.edited, proposed: it.proposed })
      continue
    }
    if (it.kind === "quitar") {
      const [, k, i, j] = it.id.split(".")
      const list = k === "exp" ? out.experience[+i]?.bullets : out.projects[+i]?.bullets
      if (list && +j < list.length) removals.push({ list, index: +j })
    } else if (it.kind === "añadir") {
      if (text && !out.skills.flatMap((g) => g.items).some((x) => x.toLowerCase() === text.toLowerCase())) {
        if (out.skills.length) out.skills[0].items.push(text)
        else out.skills.push({ items: [text] })
      }
    } else setText(out, it.id, text)
  }
  // Etiquetas con el índice ORIGINAL de cada viñeta/habilidad, para reordenar aunque otros cambios las hayan editado, quitado o añadido.
  const tags = new Map<string[], number[]>()
  const tagOf = (list: string[]) => {
    if (!tags.has(list)) tags.set(list, list.map((_, i) => i))
    return tags.get(list)!
  }
  for (const op of ops) {
    if (op.op.type === "reorder-bullets") tagOf(out.experience[op.op.exp]?.bullets ?? [])
    if (op.op.type === "reorder-skills") tagOf(out.skills[op.op.group]?.items ?? [])
  }
  // Quitar de atrás hacia adelante para no desplazar los índices pendientes.
  for (const r of removals.sort((a, b) => b.index - a.index)) {
    r.list.splice(r.index, 1)
    tags.get(r.list)?.splice(r.index, 1)
  }
  // Las habilidades añadidas al grupo 0 no tienen índice original: van al final.
  if (out.skills[0] && tags.has(out.skills[0].items)) {
    const t = tags.get(out.skills[0].items)!
    while (t.length < out.skills[0].items.length) t.push(Number.MAX_SAFE_INTEGER)
  }
  const reorder = (list: string[], order: number[]) => {
    const t = tags.get(list)
    if (!t) return
    const pos = (orig: number) => (order.includes(orig) ? order.indexOf(orig) : order.length + orig)
    const idx = list.map((_, i) => i).sort((a, b) => pos(t[a]) - pos(t[b]) || a - b)
    const items = idx.map((i) => list[i])
    list.splice(0, list.length, ...items)
  }
  for (const { op, edited, proposed } of ops) {
    if (op.type === "reorder-bullets" && out.experience[op.exp]) reorder(out.experience[op.exp].bullets, op.order)
    else if (op.type === "reorder-skills" && out.skills[op.group]) reorder(out.skills[op.group].items, op.order)
    else if (op.type === "reorder-sections") out.sectionOrder = op.order.filter((k): k is NonNullable<CV["sectionOrder"]>[number] => (SECTION_KEYS as readonly string[]).includes(k))
    else if (op.type === "headline") out.header.headline = (edited ?? proposed).trim() || out.header.headline
  }
  return out
}
