import { desc, eq, sql } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { consentLog, events } from "@/lib/db/schema"
import { cleanEvent, CONSENT_VERSION, MIN_DISTINCT_USERS, RETENTION_DAYS } from "./types"

/** postgres-js devuelve un arreglo y PGlite `{ rows }`: este ayudante unifica. */
const rowsOf = <T>(r: unknown): T[] => (Array.isArray(r) ? (r as T[]) : ((r as { rows?: T[] }).rows ?? []))

export type Consent = { personal: boolean; aggregate: boolean; version: string }

/** El consentimiento vigente de un identificador (la última decisión), o null si nunca decidió. */
export async function latestConsent(db: Db, anonId: string): Promise<Consent | null> {
  const r = (await db.select({ personal: consentLog.personal, aggregate: consentLog.aggregate, version: consentLog.version }).from(consentLog).where(eq(consentLog.anonId, anonId)).orderBy(desc(consentLog.at), desc(consentLog.id)).limit(1))[0]
  return r ?? null
}

export async function recordConsent(db: Db, c: { anonId: string; personal: boolean; aggregate: boolean }): Promise<void> {
  await db.insert(consentLog).values({ anonId: c.anonId, version: CONSENT_VERSION, personal: c.personal, aggregate: c.aggregate })
}

/** Un consentimiento sirve para registrar si es de la versión actual y acepta al menos un uso. */
export const allows = (c: Consent | null): c is Consent => !!c && c.version === CONSENT_VERSION && (c.personal || c.aggregate)

// Límite sencillo por identificador: 300 eventos por hora (evita que un navegador roto o malicioso llene la base).
const hits = new Map<string, { n: number; since: number }>()
const LIMIT = 300
const WINDOW = 3_600_000
function overLimit(anonId: string, add: number): boolean {
  const now = Date.now()
  const h = hits.get(anonId)
  if (!h || now - h.since > WINDOW) {
    hits.set(anonId, { n: add, since: now })
    if (hits.size > 5000) hits.clear()
    return false
  }
  h.n += add
  return h.n > LIMIT
}

let lastPurge = 0
/** Borra los eventos de más de 90 días (como máximo una vez cada 6 horas por proceso). */
export async function purgeOld(db: Db, force = false): Promise<number> {
  if (!force && Date.now() - lastPurge < 6 * 3_600_000) return 0
  lastPurge = Date.now()
  const r = await db.delete(events).where(sql`${events.at} < now() - make_interval(days => ${RETENTION_DAYS})`).returning({ id: events.id })
  return r.length
}

export type IngestResult = { stored: number; rejected: number } | { error: "sin_consentimiento" | "demasiados" }

/**
 * Guarda los eventos de un navegador SOLO si el servidor tiene registrado su consentimiento vigente (no se confía en lo que diga el
 * cliente). Cada evento se limpia con su lista cerrada de campos; los inválidos se descartan.
 */
export async function ingestEvents(db: Db, anonId: string, raw: { kind?: unknown; payload?: unknown }[]): Promise<IngestResult> {
  const consent = await latestConsent(db, anonId)
  if (!allows(consent)) return { error: "sin_consentimiento" }
  if (overLimit(anonId, raw.length)) return { error: "demasiados" }
  const clean = raw.map(cleanEvent).filter((e): e is NonNullable<typeof e> => !!e)
  if (clean.length > 0) {
    await db.insert(events).values(clean.map((e) => ({ anonId, kind: e.kind, payload: e.payload, personal: consent.personal, aggregate: consent.aggregate })))
    void purgeOld(db).catch(() => {})
  }
  return { stored: clean.length, rejected: raw.length - clean.length }
}

/** «Borrar mis datos»: elimina todos los eventos y consentimientos de ese identificador. */
export async function eraseUser(db: Db, anonId: string): Promise<{ events: number }> {
  const e = await db.delete(events).where(eq(events.anonId, anonId)).returning({ id: events.id })
  await db.delete(consentLog).where(eq(consentLog.anonId, anonId))
  return { events: e.length }
}

export type AffinityRow = { family: string | null; company: string | null; kind: string; n: number }

/** Qué ha abierto, guardado, adaptado, postulado o descartado esta persona (últimos 90 días). Solo con el nivel «Para mí». */
export async function affinityFor(db: Db, anonId: string): Promise<AffinityRow[]> {
  const consent = await latestConsent(db, anonId)
  if (!allows(consent) || !consent.personal) return []
  const res = await db.execute(sql`
    select j.role_family as family, j.company as company, e.kind as kind, count(*)::int as n
    from events e join jobs j on j.id = (e.payload->>'jobId')::uuid
    where e.anon_id = ${anonId}::uuid and e.personal
      and e.at > now() - make_interval(days => ${RETENTION_DAYS})
      and e.kind in ('open', 'apply_click', 'adapt_cv', 'save', 'dismiss')
      and (e.payload->>'jobId') ~ '^[0-9a-f-]{36}$'
    group by 1, 2, 3`)
  return rowsOf<AffinityRow>(res)
}

/** Búsquedas populares de una región: solo las que hicieron al menos MIN_DISTINCT_USERS identificadores distintos con nivel «Para todos». */
export async function trendingSearches(db: Db, region: string, limit = 6): Promise<{ q: string; users: number }[]> {
  const res = await db.execute(sql`
    select payload->>'q' as q, count(distinct anon_id)::int as users
    from events
    where kind = 'search' and aggregate and at > now() - interval '30 days'
      and payload->>'q' is not null and payload->>'region' = ${region}
    group by 1
    having count(distinct anon_id) >= ${MIN_DISTINCT_USERS}
    order by users desc, count(*) desc
    limit ${limit}`)
  return rowsOf<{ q: string; users: number }>(res)
}
