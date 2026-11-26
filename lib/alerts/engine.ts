import { and, asc, desc, eq, gt, inArray, isNull, or, sql, type SQL } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { alertMatches, alerts, jobs, profiles } from "@/lib/db/schema"
import { REGION_OPTIONS } from "@/lib/jobs/geo"
import { jobCols, regionFilter, toCard, type JobCard } from "@/lib/jobs/search"
import { countryName } from "@/lib/auth/profile-schema"
import { createNotification } from "./notifications"
import { filtersSchema, jobMatchesKeywords, MAX_ALERTS, type AlertFilters, type AlertInput, type Frequency } from "./filters"

/** Máximo de ofertas nuevas que una alerta toma por pasada (las más recientes). */
export const MAX_PER_PASS = 50
/** Sin abrir sus notificaciones en este tiempo, la alerta se pausa sola. */
export const INACTIVE_DAYS = 30
/** Primera pasada de una alerta nueva: mira las ofertas de los últimos 7 días. */
export const FIRST_LOOKBACK_DAYS = 7
const KEYWORD_SCAN = 5000
const iso = (s: string | null) => (s ? new Date(/[zZ]|[+-]\d\d(:?\d\d)?$/.test(s) ? s : `${s}Z`).toISOString() : null)

export type Alert = { id: string; name: string; filters: AlertFilters; frequency: Frequency; enabled: boolean; pausedReason: "inactiva" | null; lastNotifiedAt: string | null; createdAt: string }

/** La parte SQL de las condiciones (región, modalidad, contrato, nivel, familia); las palabras clave se aplican después en JS. */
export function alertWhere(f: AlertFilters, extra?: SQL): SQL | undefined {
  return and(
    eq(jobs.status, "activa"),
    or(isNull(jobs.validThrough), gt(jobs.validThrough, sql`now()`)),
    f.regions.length ? or(...f.regions.map(regionFilter)) : undefined,
    f.workModes.length ? inArray(jobs.workMode, f.workModes) : undefined,
    f.employmentTypes.length ? inArray(jobs.employmentType, f.employmentTypes) : undefined,
    f.seniority.length ? inArray(jobs.seniority, f.seniority) : undefined,
    f.families.length ? inArray(jobs.roleFamily, f.families) : undefined,
    extra,
  )
}

/**
 * Ofertas activas del buscador que cumplen las condiciones (las más recientes primero). `since`: solo las que entraron a Sooosh después de esa fecha.
 * Con palabras clave se revisan los TÍTULOS de hasta 5.000 ofertas y solo de las que coinciden se traen las tarjetas completas.
 */
export async function findMatchingJobs(db: Db, f: AlertFilters, opts: { since?: string; limit?: number } = {}): Promise<JobCard[]> {
  const limit = opts.limit ?? 100
  const where = alertWhere(f, opts.since ? gt(jobs.createdAt, opts.since) : undefined)
  const order = desc(sql`coalesce(${jobs.postedAt}, ${jobs.createdAt})`)
  let ids: string[] | null = null
  if (f.keywords.length) {
    const heads = await db.select({ id: jobs.id, title: jobs.title }).from(jobs).where(where).orderBy(order).limit(KEYWORD_SCAN)
    ids = heads.filter((h) => jobMatchesKeywords(h, f.keywords)).slice(0, limit).map((h) => h.id)
    if (!ids.length) return []
  }
  const rows = await db.select(jobCols).from(jobs).where(ids ? inArray(jobs.id, ids) : where).orderBy(order).limit(limit)
  return rows.map((r) => toCard(r))
}

/** ¿Ya toca avisar? Una alerta nunca manda más de un aviso por pasada; «diaria» y «semanal» esperan su tiempo y juntan lo nuevo. */
export function isDue(frequency: Frequency, lastNotifiedAt: string | null, now: Date): boolean {
  if (frequency === "cada_pasada" || !lastNotifiedAt) return true
  const hours = (now.getTime() - new Date(lastNotifiedAt).getTime()) / 3_600_000
  return frequency === "diaria" ? hours >= 22 : hours >= 24 * 6 + 20
}

export type AlertRunSummary = { alerts: number; paused: number; newMatches: number; notifications: number }

/** La tarea automática: busca ofertas nuevas para cada alerta activa y avisa según su frecuencia. */
export async function runAlerts(db: Db, now: Date = new Date(), log: (l: string) => void = () => {}): Promise<AlertRunSummary> {
  const s: AlertRunSummary = { alerts: 0, paused: 0, newMatches: 0, notifications: 0 }
  const active = await db.select().from(alerts).where(eq(alerts.enabled, true)).orderBy(asc(alerts.createdAt))
  for (const a of active) {
    s.alerts++
    const lastActivity = new Date(iso(a.lastOpenedAt) ?? iso(a.createdAt)!).getTime()
    if (now.getTime() - lastActivity > INACTIVE_DAYS * 86_400_000) {
      await db.update(alerts).set({ enabled: false, pausedReason: "inactiva", updatedAt: sql`now()` }).where(eq(alerts.id, a.id))
      s.paused++
      log(`  · «${a.name}»: pausada por inactividad`)
      continue
    }
    const filters = filtersSchema.parse(a.filters)
    const since = iso(a.lastRunAt) ?? new Date(now.getTime() - FIRST_LOOKBACK_DAYS * 86_400_000).toISOString()
    const found = await findMatchingJobs(db, filters, { since: new Date(new Date(since).getTime() - 5 * 60_000).toISOString(), limit: MAX_PER_PASS })
    if (found.length) {
      const ins = await db.insert(alertMatches).values(found.map((j) => ({ alertId: a.id, jobId: j.id }))).onConflictDoNothing().returning({ id: alertMatches.id })
      s.newMatches += ins.length
    }
    await db.update(alerts).set({ lastRunAt: now.toISOString() }).where(eq(alerts.id, a.id))

    // Lo encontrado y aún sin avisar (con «diaria» o «semanal» se va juntando entre avisos); solo ofertas que siguen abiertas.
    const pending = await db
      .select({ id: alertMatches.id, title: jobs.title, company: jobs.company })
      .from(alertMatches)
      .innerJoin(jobs, eq(jobs.id, alertMatches.jobId))
      .where(and(eq(alertMatches.alertId, a.id), isNull(alertMatches.notifiedAt), eq(jobs.status, "activa")))
      .orderBy(desc(alertMatches.foundAt))
      .limit(200)
    if (!pending.length || !isDue(a.frequency as Frequency, iso(a.lastNotifiedAt), now)) continue
    const n = pending.length
    await createNotification(db, {
      userId: a.userId,
      kind: "alerta",
      title: `${n >= 200 ? "200+" : n} ${n === 1 ? "oferta nueva" : "ofertas nuevas"} para «${a.name}»`,
      body: pending.slice(0, 3).map((p) => [p.title, p.company].filter(Boolean).join(" — ")).join(" · "),
      href: `/alertas/${a.id}`,
    })
    await db.update(alertMatches).set({ notifiedAt: now.toISOString() }).where(inArray(alertMatches.id, pending.map((p) => p.id)))
    await db.update(alerts).set({ lastNotifiedAt: now.toISOString() }).where(eq(alerts.id, a.id))
    s.notifications++
    log(`  ✓ «${a.name}»: ${n} ofertas nuevas → aviso`)
  }
  return s
}

/** Quita coincidencias de más de 30 días. */
export async function purgeMatches(db: Db): Promise<number> {
  const rows = await db.delete(alertMatches).where(sql`${alertMatches.foundAt} < now() - interval '30 days'`).returning({ id: alertMatches.id })
  return rows.length
}

// ---------- gestión de alertas de una persona ----------

const toAlert = (r: typeof alerts.$inferSelect): Alert => ({ id: r.id, name: r.name, filters: filtersSchema.parse(r.filters), frequency: r.frequency as Frequency, enabled: r.enabled, pausedReason: r.pausedReason as "inactiva" | null, lastNotifiedAt: iso(r.lastNotifiedAt), createdAt: iso(r.createdAt)! })

export async function listAlerts(db: Db, userId: string): Promise<Alert[]> {
  return (await db.select().from(alerts).where(eq(alerts.userId, userId)).orderBy(asc(alerts.createdAt))).map(toAlert)
}

export async function getAlert(db: Db, userId: string, id: string): Promise<Alert | null> {
  const [r] = await db.select().from(alerts).where(and(eq(alerts.id, id), eq(alerts.userId, userId))).limit(1)
  return r ? toAlert(r) : null
}

export async function createAlert(db: Db, userId: string, input: AlertInput): Promise<{ id: string } | { error: "limit" }> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(alerts).where(eq(alerts.userId, userId))
  if (n >= MAX_ALERTS) return { error: "limit" }
  const [row] = await db.insert(alerts).values({ userId, name: input.name, filters: input.filters, frequency: input.frequency }).returning({ id: alerts.id })
  return { id: row.id }
}

/** Editar condiciones reinicia la búsqueda: lo que ya se encontró con las condiciones viejas no vale. */
export async function updateAlert(db: Db, userId: string, id: string, input: AlertInput): Promise<boolean> {
  const rows = await db.update(alerts).set({ name: input.name, filters: input.filters, frequency: input.frequency, lastRunAt: null, updatedAt: sql`now()` }).where(and(eq(alerts.id, id), eq(alerts.userId, userId))).returning({ id: alerts.id })
  if (rows.length) await db.delete(alertMatches).where(and(eq(alertMatches.alertId, id), isNull(alertMatches.notifiedAt)))
  return rows.length > 0
}

/** Pausar o reanudar. Al reanudar cuenta como actividad (se reinicia el reloj de inactividad). */
export async function setAlertEnabled(db: Db, userId: string, id: string, enabled: boolean): Promise<boolean> {
  const rows = await db.update(alerts).set({ enabled, pausedReason: null, ...(enabled ? { lastOpenedAt: sql`now()` } : {}), updatedAt: sql`now()` }).where(and(eq(alerts.id, id), eq(alerts.userId, userId))).returning({ id: alerts.id })
  return rows.length > 0
}

export async function deleteAlert(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db.delete(alerts).where(and(eq(alerts.id, id), eq(alerts.userId, userId))).returning({ id: alerts.id })
  return rows.length > 0
}

/** Abrir una alerta (o el centro de notificaciones) cuenta como actividad. */
export async function touchAlerts(db: Db, userId: string, alertId?: string): Promise<void> {
  await db.update(alerts).set({ lastOpenedAt: sql`now()` }).where(alertId ? and(eq(alerts.userId, userId), eq(alerts.id, alertId)) : eq(alerts.userId, userId))
}

/** Al abrir los resultados: devuelve qué ofertas eran nuevas (sin ver) y las marca vistas. */
export async function takeUnseen(db: Db, alertId: string): Promise<Set<string>> {
  const rows = await db.update(alertMatches).set({ seenAt: sql`now()` }).where(and(eq(alertMatches.alertId, alertId), isNull(alertMatches.seenAt))).returning({ jobId: alertMatches.jobId })
  return new Set(rows.map((r) => r.jobId))
}

/** La alerta inicial (una sola vez): los cargos de interés del registro, en el país de residencia. Si la persona la borra, no vuelve. */
export async function ensureDefaultAlert(db: Db, userId: string): Promise<boolean> {
  const claimed = await db.update(profiles).set({ alertsSeeded: true }).where(and(eq(profiles.id, userId), eq(profiles.alertsSeeded, false))).returning({ country: profiles.country, roles: profiles.roleInterests })
  if (!claimed.length) return false
  const { country, roles } = claimed[0]
  const inRegions = REGION_OPTIONS.some((r) => r.code === country)
  const filters = filtersSchema.parse({ regions: inRegions ? [country] : [], keywords: roles.slice(0, 10) })
  await db.insert(alerts).values({ userId, name: `Mis cargos en ${countryName(country)}`.slice(0, 60), filters, frequency: "cada_pasada" })
  return true
}
