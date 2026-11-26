import { and, desc, eq, isNull, lt, ne, or, sql } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { trackedOffers } from "@/lib/db/schema"
import { normalizeSourceUrl } from "@/lib/jobs/url"
import { notifyOfferClosed } from "@/lib/alerts/notifications"
import { companyKey } from "./company"
import type { Offer } from "@/lib/schemas/offer"
import type { Verdict } from "./liveness"

/** Tope de ofertas guardadas por persona. */
export const MAX_TRACKED = 200
/** Cuántas revisiones seguidas dicen «cerrada» antes de marcarla finalizada (una caída puntual del sitio no basta). */
export const DEAD_CONFIRMATIONS = 2
export const RECHECK_HOURS = 12
export const CONFIRM_HOURS = 3
export const CLOSED_RECHECK_HOURS = 72
export const CLOSED_WATCH_DAYS = 30

export type TrackedStatus = "vigente" | "finalizada" | "sin_verificar"

export type TrackedOffer = {
  id: string
  sourceUrl: string
  sourceName: string
  title: string
  company: string | null
  postedAt: string | null
  validThrough: string | null
  status: TrackedStatus
  lastCheckedAt: string | null
  closedDetectedAt: string | null
  checkNote: string | null
  collectionId: string | null
  note: string | null
  origin: "enlace" | "buscador" | "texto"
  jobId: string | null
  savedAt: string
  offer: Offer
  text: string
}

const iso = (s: string | null): string | null => (s ? new Date(/[zZ]|[+-]\d\d(:?\d\d)?$/.test(s) ? s : `${s}Z`).toISOString() : null)
const validDate = (s?: string): string | null => {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export type SaveInput = { url: string; offer: Offer; text: string; postedAt?: string; validThrough?: string }

/** Guarda la oferta completa (o la actualiza si ya estaba: misma dirección canónica). Devuelve su id y si es nueva. */
export async function saveTrackedOffer(db: Db, userId: string, input: SaveInput): Promise<{ id: string; created: boolean } | { error: "limit" | "invalid_url" }> {
  let canon: { url: string; source: string }
  try {
    canon = normalizeSourceUrl(input.url)
  } catch {
    return { error: "invalid_url" }
  }
  const values = {
    originalUrl: input.url.slice(0, 1200),
    sourceName: canon.source,
    title: input.offer.title,
    company: input.offer.company ?? null,
    companyKey: companyKey(input.offer.company),
    offer: input.offer,
    text: input.text.slice(0, 24000),
    postedAt: validDate(input.postedAt),
    validThrough: validDate(input.validThrough),
    updatedAt: sql`now()`,
  }
  const [existing] = await db.select({ id: trackedOffers.id }).from(trackedOffers).where(and(eq(trackedOffers.userId, userId), eq(trackedOffers.sourceUrl, canon.url))).limit(1)
  if (existing) {
    await db.update(trackedOffers).set(values).where(eq(trackedOffers.id, existing.id))
    return { id: existing.id, created: false }
  }
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(trackedOffers).where(eq(trackedOffers.userId, userId))
  if (n >= MAX_TRACKED) return { error: "limit" }
  const [row] = await db.insert(trackedOffers).values({ userId, sourceUrl: canon.url, ...values }).returning({ id: trackedOffers.id })
  return { id: row.id, created: true }
}

export async function listTrackedOffers(db: Db, userId: string): Promise<TrackedOffer[]> {
  const rows = await db.select().from(trackedOffers).where(eq(trackedOffers.userId, userId)).orderBy(desc(trackedOffers.createdAt))
  return rows.map((r) => ({
    id: r.id,
    sourceUrl: r.originalUrl,
    sourceName: r.sourceName,
    title: r.title,
    company: r.company,
    postedAt: iso(r.postedAt),
    validThrough: iso(r.validThrough),
    status: r.status as TrackedStatus,
    lastCheckedAt: iso(r.lastCheckedAt),
    closedDetectedAt: iso(r.closedDetectedAt),
    checkNote: r.checkNote,
    collectionId: r.collectionId,
    note: r.note,
    origin: r.origin as TrackedOffer["origin"],
    jobId: r.jobId,
    savedAt: iso(r.createdAt)!,
    offer: r.offer as Offer,
    text: r.text,
  }))
}

export async function removeTrackedOffer(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(trackedOffers).where(and(eq(trackedOffers.id, id), eq(trackedOffers.userId, userId))).returning({ id: trackedOffers.id })
  return rows.length > 0
}

/** Qué le pasa a una oferta tras una revisión. Función pura: la decisión de «finalizada» vive aquí y se prueba sin red. */
export function nextState(prev: { status: TrackedStatus; deadStreak: number; closedDetectedAt: string | null; lastAliveAt: string | null }, v: Verdict, now: Date) {
  const at = now.toISOString()
  if (v.state === "alive") return { status: "vigente" as const, deadStreak: 0, lastAliveAt: at, closedDetectedAt: null, checkNote: v.reason, lastCheckedAt: at }
  if (v.state === "unknown") return { status: prev.status, deadStreak: prev.deadStreak, lastAliveAt: prev.lastAliveAt, closedDetectedAt: prev.closedDetectedAt, checkNote: v.reason, lastCheckedAt: at }
  const streak = prev.deadStreak + 1
  const closed = v.declared || streak >= DEAD_CONFIRMATIONS || prev.status === "finalizada"
  return { status: closed ? ("finalizada" as const) : prev.status, deadStreak: streak, lastAliveAt: prev.lastAliveAt, closedDetectedAt: closed ? (prev.closedDetectedAt ?? at) : null, checkNote: v.reason, lastCheckedAt: at }
}

export type CheckSummary = { urls: number; alive: number; dead: number; unknown: number; newlyClosed: number }

/**
 * Revisa las ofertas que toca (la tarea automática). Cada enlace distinto se abre UNA vez aunque varias personas lo hayan guardado.
 * Toca: nunca revisada, o revisada hace > 12 h (3 h si la última dijo «cerrada» y falta confirmar); las finalizadas se vuelven a mirar cada 72 h
 * durante 30 días por si la fuente la reabre.
 */
export async function checkDueOffers(db: Db, opts: { probe: (url: string) => Promise<Verdict>; limit?: number; now?: Date; log?: (l: string) => void }): Promise<CheckSummary> {
  const now = opts.now ?? new Date()
  const iso_ = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString()
  const due = await db
    .select()
    .from(trackedOffers)
    .where(
      or(
        and(ne(trackedOffers.status, "finalizada"), or(isNull(trackedOffers.lastCheckedAt), and(eq(trackedOffers.deadStreak, 0), lt(trackedOffers.lastCheckedAt, iso_(RECHECK_HOURS))), and(sql`${trackedOffers.deadStreak} > 0`, lt(trackedOffers.lastCheckedAt, iso_(CONFIRM_HOURS))))),
        and(eq(trackedOffers.status, "finalizada"), sql`${trackedOffers.closedDetectedAt} > ${iso_(CLOSED_WATCH_DAYS * 24)}`, lt(trackedOffers.lastCheckedAt, iso_(CLOSED_RECHECK_HOURS))),
      ),
    )
    .orderBy(sql`${trackedOffers.lastCheckedAt} asc nulls first`)
    .limit(opts.limit ?? 150)
  const byUrl = new Map<string, typeof due>()
  for (const r of due) byUrl.set(r.sourceUrl, [...(byUrl.get(r.sourceUrl) ?? []), r])
  const s: CheckSummary = { urls: byUrl.size, alive: 0, dead: 0, unknown: 0, newlyClosed: 0 }
  const entries = [...byUrl.entries()]
  // Pocas conexiones a la vez y de a tandas: no se castiga a ningún sitio.
  for (let i = 0; i < entries.length; i += 4) {
    await Promise.all(
      entries.slice(i, i + 4).map(async ([url, rows]) => {
        const v = await opts.probe(rows[0].originalUrl || url)
        s[v.state]++
        for (const r of rows) {
          const next = nextState({ status: r.status as TrackedStatus, deadStreak: r.deadStreak, closedDetectedAt: r.closedDetectedAt, lastAliveAt: r.lastAliveAt }, v, now)
          const justClosed = next.status === "finalizada" && r.status !== "finalizada"
          if (justClosed) s.newlyClosed++
          await db.update(trackedOffers).set({ ...next, updatedAt: sql`now()` }).where(eq(trackedOffers.id, r.id))
          if (justClosed) await notifyOfferClosed(db, r.userId, { id: r.id, title: r.title, company: r.company })
        }
        opts.log?.(`  ${v.state === "alive" ? "✓" : v.state === "dead" ? "✗" : "?"} ${url} — ${v.reason}`)
      }),
    )
  }
  return s
}

/** Revisa solo una oferta (justo al guardarla). */
export async function checkOne(db: Db, id: string, probe: (url: string) => Promise<Verdict>, now = new Date()): Promise<void> {
  const [r] = await db.select().from(trackedOffers).where(eq(trackedOffers.id, id)).limit(1)
  if (!r) return
  const v = await probe(r.originalUrl)
  const next = nextState({ status: r.status as TrackedStatus, deadStreak: r.deadStreak, closedDetectedAt: r.closedDetectedAt, lastAliveAt: r.lastAliveAt }, v, now)
  await db.update(trackedOffers).set({ ...next, updatedAt: sql`now()` }).where(eq(trackedOffers.id, id))
  if (next.status === "finalizada" && r.status !== "finalizada") await notifyOfferClosed(db, r.userId, { id: r.id, title: r.title, company: r.company })
}

