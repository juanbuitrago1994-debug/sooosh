import { and, asc, eq, sql } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { collections, jobs, trackedOffers } from "@/lib/db/schema"
import { normalizeSourceUrl } from "@/lib/jobs/url"
import { offerToText } from "@/lib/jobs/prefill"
import type { Offer } from "@/lib/schemas/offer"
import { companyKey } from "./company"
import { MAX_TRACKED } from "./store"

import { MAX_COLLECTIONS, MAX_NAME, MAX_NOTE, type Collection } from "./collections-shared"

export { MAX_COLLECTIONS, MAX_NAME, MAX_NOTE, type Collection }
export type CollectionResult = { id: string } | { error: "limit" | "duplicate" | "invalid" }

const cleanName = (n: string) => n.trim().replace(/\s+/g, " ").slice(0, MAX_NAME)

export async function listCollections(db: Db, userId: string): Promise<Collection[]> {
  return db.select({ id: collections.id, name: collections.name }).from(collections).where(eq(collections.userId, userId)).orderBy(asc(collections.createdAt))
}

export async function createCollection(db: Db, userId: string, name: string): Promise<CollectionResult> {
  const clean = cleanName(name)
  if (!clean) return { error: "invalid" }
  const existing = await listCollections(db, userId)
  if (existing.length >= MAX_COLLECTIONS) return { error: "limit" }
  if (existing.some((c) => c.name.toLowerCase() === clean.toLowerCase())) return { error: "duplicate" }
  const [row] = await db.insert(collections).values({ userId, name: clean }).returning({ id: collections.id })
  return { id: row.id }
}

export async function renameCollection(db: Db, userId: string, id: string, name: string): Promise<CollectionResult> {
  const clean = cleanName(name)
  if (!clean) return { error: "invalid" }
  const existing = await listCollections(db, userId)
  if (!existing.some((c) => c.id === id)) return { error: "invalid" }
  if (existing.some((c) => c.id !== id && c.name.toLowerCase() === clean.toLowerCase())) return { error: "duplicate" }
  await db.update(collections).set({ name: clean }).where(and(eq(collections.id, id), eq(collections.userId, userId)))
  return { id }
}

/** Borra la categoría; sus ofertas NO se borran: quedan «sin categoría» (lo hace la base: `on delete set null`). */
export async function deleteCollection(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(collections).where(and(eq(collections.id, id), eq(collections.userId, userId))).returning({ id: collections.id })
  return rows.length > 0
}

/** Mueve una oferta a una categoría (o a «sin categoría» con `null`). Las dos cosas tienen que ser de la persona. */
export async function moveOffer(db: Db, userId: string, offerId: string, collectionId: string | null): Promise<boolean> {
  if (collectionId) {
    const [c] = await db.select({ id: collections.id }).from(collections).where(and(eq(collections.id, collectionId), eq(collections.userId, userId))).limit(1)
    if (!c) return false
  }
  const rows = await db.update(trackedOffers).set({ collectionId, updatedAt: sql`now()` }).where(and(eq(trackedOffers.id, offerId), eq(trackedOffers.userId, userId))).returning({ id: trackedOffers.id })
  return rows.length > 0
}

export async function setNote(db: Db, userId: string, offerId: string, note: string): Promise<boolean> {
  const clean = note.trim().slice(0, MAX_NOTE)
  const rows = await db.update(trackedOffers).set({ note: clean || null, updatedAt: sql`now()` }).where(and(eq(trackedOffers.id, offerId), eq(trackedOffers.userId, userId))).returning({ id: trackedOffers.id })
  return rows.length > 0
}

/**
 * Guarda en la cuenta una oferta del buscador (copia completa). Si la persona ya la tenía por enlace, solo se enlaza con la del buscador.
 * Una oferta que el buscador ya cerró entra como «finalizada».
 */
export async function saveJobAsOffer(db: Db, userId: string, jobId: string): Promise<{ id: string; created: boolean } | { error: "not_found" | "limit" }> {
  const [job] = await db
    .select({ sourceUrl: jobs.sourceUrl, sourceName: jobs.sourceName, title: jobs.title, company: jobs.company, offer: jobs.offer, postedAt: jobs.postedAt, validThrough: jobs.validThrough, status: jobs.status, locationText: jobs.locationText, remoteScope: jobs.remoteScope })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1)
  if (!job) return { error: "not_found" }
  const [mine] = await db.select({ id: trackedOffers.id }).from(trackedOffers).where(and(eq(trackedOffers.userId, userId), eq(trackedOffers.jobId, jobId))).limit(1)
  if (mine) return { id: mine.id, created: false }
  let canon = job.sourceUrl
  try {
    canon = normalizeSourceUrl(job.sourceUrl).url
  } catch {
    /* dirección no estándar: se guarda tal cual */
  }
  const [byUrl] = await db.select({ id: trackedOffers.id }).from(trackedOffers).where(and(eq(trackedOffers.userId, userId), eq(trackedOffers.sourceUrl, canon))).limit(1)
  if (byUrl) {
    await db.update(trackedOffers).set({ jobId, updatedAt: sql`now()` }).where(eq(trackedOffers.id, byUrl.id))
    return { id: byUrl.id, created: false }
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(trackedOffers).where(eq(trackedOffers.userId, userId))
  if (n >= MAX_TRACKED) return { error: "limit" }
  const offer = job.offer as Offer
  const closed = job.status === "cerrada"
  const [row] = await db
    .insert(trackedOffers)
    .values({
      userId,
      sourceUrl: canon.slice(0, 600),
      originalUrl: job.sourceUrl.slice(0, 1200),
      sourceName: job.sourceName,
      title: job.title,
      company: job.company,
      companyKey: companyKey(job.company),
      offer,
      text: offerToText(offer, { location: job.locationText, remoteScope: job.remoteScope }).slice(0, 24000),
      postedAt: job.postedAt,
      validThrough: job.validThrough,
      origin: "buscador",
      jobId,
      ...(closed ? { status: "finalizada", closedDetectedAt: new Date().toISOString() } : {}),
    })
    .returning({ id: trackedOffers.id })
  return { id: row.id, created: true }
}

/** Quita de la cuenta la oferta que vino del buscador. */
export async function removeJobOffer(db: Db, userId: string, jobId: string): Promise<boolean> {
  const rows = await db.delete(trackedOffers).where(and(eq(trackedOffers.userId, userId), eq(trackedOffers.jobId, jobId))).returning({ id: trackedOffers.id })
  return rows.length > 0
}

/** Ids de las ofertas del buscador que la persona tiene guardadas (para mostrar el marcador en cualquier dispositivo). */
export async function savedJobIds(db: Db, userId: string): Promise<string[]> {
  const rows = await db.select({ jobId: trackedOffers.jobId }).from(trackedOffers).where(and(eq(trackedOffers.userId, userId), sql`${trackedOffers.jobId} is not null`))
  return rows.map((r) => r.jobId!).filter(Boolean)
}
