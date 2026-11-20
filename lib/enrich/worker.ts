import { eq, sql } from "drizzle-orm"
import { AIError } from "@/lib/ai"
import type { Db } from "@/lib/db"
import { jobEnrichment, jobs } from "@/lib/db/schema"
import { skillsIn } from "@/lib/analysis/offer-profile"
import { offerSchema, type Offer } from "@/lib/schemas/offer"
import { isRich, mergeEnriched, MIN_TEXT_CHARS } from "./merge"
import { labelCompact } from "./lines"
import { nextPending } from "./queue"

export type EnrichReport = { processed: number; improved: number; omitted: number; failed: number; stoppedBy?: string; ms: number; avgMs: number | null }
const FATAL = new Set(["unreachable", "not_configured", "model_missing", "timeout"])

/**
 * Procesa hasta `limit` ofertas de la cola, una por una (el modelo local atiende de a una). Por cada una: el modelo señala qué líneas son
 * requisitos, tareas y deseables (números de línea; ya existente en `parseOfferText`), el código arma las listas con líneas LITERALES y
 * pasa la guardia anti-invención, y el resultado se mezcla sin pisar lo que ya estaba bien. Al terminar el texto original se borra.
 * Si Ollama no responde, se detiene (no marca como fallidas las que no pudo intentar).
 */
export async function enrichPending(db: Db, limit = 10, signal?: AbortSignal): Promise<EnrichReport> {
  const t0 = Date.now()
  const rep: EnrichReport = { processed: 0, improved: 0, omitted: 0, failed: 0, ms: 0, avgMs: null }
  let spent = 0
  for (const item of await nextPending(db, limit)) {
    if (signal?.aborted) break
    const t = Date.now()
    const row = (await db.select().from(jobs).where(eq(jobs.id, item.jobId)).limit(1))[0]
    if (!row || !item.text || item.text.length < MIN_TEXT_CHARS) {
      await db.update(jobEnrichment).set({ status: "omitido", text: null, processedAt: sql`now()` }).where(eq(jobEnrichment.jobId, item.jobId))
      rep.omitted++
      continue
    }
    try {
      const current = row.offer as Offer
      const labeled = await labelCompact(current.title, current.company, item.text, signal)
      // Sin resultado utilizable (el modelo no señaló nada o devolvió algo inválido): se deja la oferta como estaba.
      const { offer, added } = labeled.offer ? mergeEnriched(current, { ...labeled.offer, title: current.title, company: current.company }) : { offer: current, added: 0 }
      const final = offerSchema.parse(offer)
      const improved = added > 0 && isRich(final)
      if (improved) {
        const skills = [...new Set([...row.skills, ...(final.tools ?? []), ...skillsIn(item.text).filter((s) => s.category === "tool" || s.category === "tech").map((s) => s.label)])].slice(0, 20)
        await db
          .update(jobs)
          .set({ offer: final, skills, seniority: row.seniority ?? (final.seniority && final.seniority !== "no-especificado" ? final.seniority : null), embedding: null })
          .where(eq(jobs.id, item.jobId))
        rep.improved++
      } else rep.omitted++
      const ms = Date.now() - t
      spent += ms
      await db.update(jobEnrichment).set({ status: improved ? "hecho" : "omitido", text: null, processedAt: sql`now()`, ms, error: null }).where(eq(jobEnrichment.jobId, item.jobId))
      rep.processed++
    } catch (e) {
      if ((e as Error).name === "AbortError") break
      if (e instanceof AIError && FATAL.has(e.code)) {
        rep.stoppedBy = e.message
        break
      }
      const attempts = item.attempts + 1
      await db.update(jobEnrichment).set({ attempts, status: attempts >= 3 ? "fallido" : "pendiente", error: (e as Error).message.slice(0, 200) }).where(eq(jobEnrichment.jobId, item.jobId))
      rep.failed++
    }
  }
  rep.ms = Date.now() - t0
  rep.avgMs = rep.processed > 0 ? Math.round(spent / rep.processed) : null
  return rep
}
