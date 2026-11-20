import { z } from "zod"
import { getProvider } from "@/lib/ai"
import type { Db } from "@/lib/db"
import { getStats, markSummarized, recentDecisions, replaceLearnedRules } from "./store"

/** Cada cuántas decisiones nuevas se vuelve a resumir el perfil de preferencias. */
export const SUMMARIZE_EVERY = Number(process.env.LEARN_EVERY ?? 10)

export const rulesSchema = z.object({ rules: z.array(z.string()).max(8) })

export const SUMMARIZE_PROMPT = `Analizas las decisiones de una persona sobre cambios que se propusieron a su currículum (aceptó, rechazó o editó) y resumes sus PREFERENCIAS DE REDACCIÓN como reglas.
Devuelve {"rules": [...]} con un máximo de 8 reglas. Cada una: una frase imperativa corta y general sobre estilo o criterio (por ejemplo, el largo de las viñetas, el uso de verbos de acción, qué evitar cambiar).
Solo incluye reglas respaldadas por al menos 2 decisiones o por una edición clara de la persona. Sin datos personales, nombres, empresas, cifras ni tecnologías concretas. Si no hay un patrón claro, devuelve una lista vacía.`

const clean = (r: string) => r.replace(/\s+/g, " ").trim()

/** Reglas válidas: cortas, sin correos ni URLs, sin duplicados. */
export function sanitizeRules(rs: string[]): string[] {
  const out: string[] = []
  for (const raw of rs) {
    const r = clean(raw).replace(/^[-•*\d.)\s]+/, "")
    if (r.length < 12 || r.length > 200 || /@|https?:\/\//i.test(r)) continue
    if (!out.some((o) => o.toLowerCase() === r.toLowerCase())) out.push(r)
  }
  return out.slice(0, 8)
}

/** Si hay suficientes decisiones nuevas, resume las preferencias con el modelo local y reemplaza las reglas aprendidas. */
export async function maybeSummarize(db: Db, opts: { every?: number; signal?: AbortSignal; force?: boolean } = {}): Promise<{ ran: boolean; rules?: string[] }> {
  const every = opts.every ?? SUMMARIZE_EVERY
  const stats = await getStats(db)
  if (!opts.force && stats.sinceSummary < every) return { ran: false }
  const rows = await recentDecisions(db, 40)
  if (rows.length === 0) return { ran: false }
  const lines = rows
    .map((r) => `[${r.decision}] (${r.kind} · ${r.section}) «${r.original.slice(0, 160)}» → «${r.proposal.slice(0, 160)}»${r.editedText ? ` → editó: «${r.editedText.slice(0, 160)}»` : ""}${r.reason ? ` · motivo: ${r.reason}` : ""}`)
    .join("\n")
    .slice(0, 6000)
  const { data } = await getProvider().generateStructured({ system: SUMMARIZE_PROMPT, user: `Decisiones recientes:\n${lines}`, schema: rulesSchema, signal: opts.signal, options: { numPredict: 400 } })
  const rules = sanitizeRules(data.rules)
  await replaceLearnedRules(db, rules)
  await markSummarized(db)
  return { ran: true, rules }
}
