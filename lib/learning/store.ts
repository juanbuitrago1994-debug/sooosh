import { and, desc, eq, inArray, sql } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { decisions, meta, rules } from "@/lib/db/schema"

/** Almacén de la memoria de preferencias: decisiones, reglas y contadores (Supabase). */
export type ChangeKind = "cambiar" | "quitar" | "añadir"
export type DecisionKind = "aceptado" | "rechazado" | "editado"

export type DecisionInput = {
  ref: string
  kind: ChangeKind
  section: string
  risk: string
  original: string
  proposal: string
  decision: DecisionKind
  editedText?: string
  reason?: string
  changeReason?: string
  offerTitle?: string
  language?: string
}

const now = () => new Date().toISOString()
const clip = (s: string | undefined, n: number) => (s === undefined ? undefined : s.slice(0, n))

/** Guarda una decisión; si ya existía (misma `ref`), la actualiza. */
export async function recordDecision(db: Db, d: DecisionInput): Promise<void> {
  const t = now()
  const row = {
    kind: d.kind,
    section: clip(d.section, 60)!,
    risk: d.risk,
    original: clip(d.original, 1500)!,
    proposal: clip(d.proposal, 1500)!,
    decision: d.decision,
    editedText: clip(d.editedText, 1500) ?? null,
    reason: clip(d.reason, 300) ?? null,
    changeReason: clip(d.changeReason, 300) ?? null,
    offerTitle: clip(d.offerTitle, 200) ?? null,
    language: clip(d.language, 10) ?? null,
    updatedAt: t,
  }
  await db.insert(decisions).values({ ref: clip(d.ref, 200)!, createdAt: t, ...row }).onConflictDoUpdate({ target: decisions.ref, set: row })
}

export async function setDecisionReason(db: Db, ref: string, reason: string): Promise<void> {
  await db.update(decisions).set({ reason: reason.slice(0, 300) || null, updatedAt: now() }).where(eq(decisions.ref, ref))
}

export type Stats = { total: number; accepted: number; rejected: number; edited: number; sinceSummary: number }

export async function getStats(db: Db): Promise<Stats> {
  const rows = await db.select({ decision: decisions.decision, n: sql<number>`count(*)` }).from(decisions).groupBy(decisions.decision)
  const by = Object.fromEntries(rows.map((r) => [r.decision, Number(r.n)]))
  const total = Object.values(by).reduce((a, b) => a + b, 0)
  const upto = Number((await db.select().from(meta).where(eq(meta.key, "summarized_upto")))[0]?.value ?? 0)
  return { total, accepted: by["aceptado"] ?? 0, rejected: by["rechazado"] ?? 0, edited: by["editado"] ?? 0, sinceSummary: Math.max(0, total - upto) }
}

export async function markSummarized(db: Db): Promise<void> {
  const { total } = await getStats(db)
  await db.insert(meta).values({ key: "summarized_upto", value: String(total) }).onConflictDoUpdate({ target: meta.key, set: { value: String(total) } })
}

export type Rule = { id: number; text: string; source: "aprendida" | "manual"; enabled: boolean }

export async function listRules(db: Db): Promise<Rule[]> {
  const r = await db.select().from(rules).orderBy(rules.id)
  return r.map((x) => ({ id: x.id, text: x.text, source: x.source as Rule["source"], enabled: x.enabled }))
}

export async function addRule(db: Db, text: string, source: Rule["source"] = "manual"): Promise<void> {
  const t = now()
  await db.insert(rules).values({ text: text.trim().slice(0, 240), source, enabled: true, createdAt: t, updatedAt: t })
}

/** Editar una regla aprendida la vuelve "manual": el siguiente resumen ya no la pisa. */
export async function updateRule(db: Db, id: number, patch: { text?: string; enabled?: boolean }): Promise<void> {
  const set: Partial<typeof rules.$inferInsert> = { updatedAt: now() }
  if (patch.text !== undefined) {
    set.text = patch.text.trim().slice(0, 240)
    set.source = "manual"
  }
  if (patch.enabled !== undefined) set.enabled = patch.enabled
  await db.update(rules).set(set).where(eq(rules.id, id))
}

export async function deleteRule(db: Db, id: number): Promise<void> {
  await db.delete(rules).where(eq(rules.id, id))
}

/** Sustituye las reglas APRENDIDAS por un conjunto nuevo (las manuales no se tocan ni se duplican). */
export async function replaceLearnedRules(db: Db, texts: string[]): Promise<void> {
  const manual = (await listRules(db)).filter((r) => r.source === "manual").map((r) => r.text.toLowerCase())
  await db.delete(rules).where(eq(rules.source, "aprendida"))
  for (const t of texts) if (!manual.includes(t.toLowerCase())) await addRule(db, t, "aprendida")
}

/** Borra TODO lo aprendido: decisiones, reglas y contadores. */
export async function resetAll(db: Db): Promise<void> {
  await db.delete(decisions)
  await db.delete(rules)
  await db.delete(meta)
}

export type Example = { kind: string; section: string; original: string; final: string; decision: DecisionKind }

/** Pocos ejemplos recientes que la persona aceptó o editó (lo editado vale más: es lo que de verdad quería). */
export async function examplesFor(db: Db, kind: string, section: string, limit = 3): Promise<Example[]> {
  const rows = await db
    .select()
    .from(decisions)
    .where(and(eq(decisions.kind, kind), inArray(decisions.decision, ["aceptado", "editado"])))
    .orderBy(desc(decisions.updatedAt))
    .limit(40)
  const rank = (r: (typeof rows)[number]) => (r.decision === "editado" ? 0 : 1) + (r.section === section ? 0 : 2)
  return rows
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, limit)
    .map((r) => ({ kind: r.kind, section: r.section, original: r.original, final: r.editedText ?? r.proposal, decision: r.decision as DecisionKind }))
}

export async function recentDecisions(db: Db, limit = 40) {
  return db.select().from(decisions).orderBy(desc(decisions.updatedAt)).limit(limit)
}
