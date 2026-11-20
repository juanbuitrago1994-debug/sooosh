import { createHash } from "node:crypto"
import { and, eq, inArray, lt, sql } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { jobEnrichment, jobs } from "@/lib/db/schema"
import { isRich, MIN_TEXT_CHARS } from "./merge"
import type { JobDraft } from "@/lib/jobs/draft"

const sha = (s: string) => createHash("sha1").update(s).digest("base64url").slice(0, 22)

export type QueueCandidate = { draft: JobDraft; text: string }

/**
 * Pone en cola las ofertas POBRES recién sincronizadas (las que no tienen al menos 2 requisitos o tareas) para que la IA las estructure.
 * Se guarda el texto original solo hasta procesarlo. Si el texto no cambió desde la última vez, no se vuelve a encolar.
 */
export async function queueEnrichment(db: Db, items: QueueCandidate[]): Promise<{ queued: number }> {
  const poor = items.filter((i) => !isRich(i.draft.offer) && i.text.length >= MIN_TEXT_CHARS)
  let queued = 0
  for (let i = 0; i < poor.length; i += 100) {
    const chunk = poor.slice(i, i + 100)
    const rows = await db.select({ id: jobs.id, url: jobs.sourceUrl }).from(jobs).where(inArray(jobs.sourceUrl, chunk.map((c) => c.draft.sourceUrl)))
    const idByUrl = new Map(rows.map((r) => [r.url, r.id]))
    const prev = new Map((await db.select({ id: jobEnrichment.jobId, h: jobEnrichment.contentHash, s: jobEnrichment.status }).from(jobEnrichment).where(inArray(jobEnrichment.jobId, [...idByUrl.values()]))).map((r) => [r.id, r]))
    const values = chunk.flatMap((c) => {
      const id = idByUrl.get(c.draft.sourceUrl)
      if (!id) return []
      const hash = sha(c.text)
      const p = prev.get(id)
      if (p && p.h === hash && p.s !== "pendiente") return [] // mismo texto: ya se procesó (o se descartó)
      return [{ jobId: id, contentHash: hash, text: c.text.slice(0, 12_000), status: "pendiente", attempts: 0, error: null, processedAt: null }]
    })
    if (values.length === 0) continue
    await db
      .insert(jobEnrichment)
      .values(values)
      .onConflictDoUpdate({
        target: jobEnrichment.jobId,
        set: { contentHash: sql`excluded."content_hash"`, text: sql`excluded."text"`, status: sql`'pendiente'`, attempts: sql`0`, error: sql`null`, processedAt: sql`null`, queuedAt: sql`now()` },
      })
    queued += values.length
  }
  return { queued }
}

export type EnrichStats = { pendiente: number; hecho: number; omitido: number; fallido: number }

export async function enrichStats(db: Db): Promise<EnrichStats> {
  const rows = await db.select({ status: jobEnrichment.status, n: sql<number>`count(*)::int` }).from(jobEnrichment).groupBy(jobEnrichment.status)
  const out: EnrichStats = { pendiente: 0, hecho: 0, omitido: 0, fallido: 0 }
  for (const r of rows) if (r.status in out) out[r.status as keyof EnrichStats] = Number(r.n)
  return out
}

/** Las siguientes en la cola (las más antiguas primero; las que ya fallaron 3 veces no se reintentan). */
export async function nextPending(db: Db, limit: number) {
  return db
    .select({ jobId: jobEnrichment.jobId, text: jobEnrichment.text, attempts: jobEnrichment.attempts })
    .from(jobEnrichment)
    .where(and(eq(jobEnrichment.status, "pendiente"), lt(jobEnrichment.attempts, 3)))
    .orderBy(jobEnrichment.queuedAt)
    .limit(limit)
}
