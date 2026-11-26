import { and, desc, eq, isNull, lt, sql } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { jobs, syncRuns } from "@/lib/db/schema"
import { enrichPending } from "@/lib/enrich/worker"
import { purgeOld } from "@/lib/events/server"
import { embedMissing } from "@/lib/jobs/embed"
import { expireStale } from "./expire"
import { effective, listCatalog, type CatalogRow } from "./catalog"
import { acquireLock, releaseLock } from "./lock"
import { purgeMatches, runAlerts, type AlertRunSummary } from "@/lib/alerts/engine"
import { purgeNotifications } from "@/lib/alerts/notifications"
import { probeOfferLink } from "@/lib/tracking/liveness"
import { checkDueOffers, type CheckSummary } from "@/lib/tracking/store"
import { snapshotSourceStats } from "./snapshots"
import { PORTALS, REMOTE_SOURCES, syncAllCompanies, syncGetOnBoard, syncPortal, syncRemote } from "./sync"
import type { SyncReport } from "./types"

/**
 * Sincronización automática. Corre desde GitHub Actions (cada 3 h, solo la fase «fetch» y los vectores) y desde el Mac (launchd, todo).
 * Cada fuente tiene su propia cadencia —respetuosa con ella— y se omite si se leyó con éxito hace menos de ese tiempo; así el cron puede
 * pasar cada 3 h sin que ninguna fuente se lea de más (Remotive pide ≤ 4 lecturas al día; Jobicy responde 429 si se abusa).
 */
export type Phase = "fetch" | "vectors" | "enrich" | "track" | "alerts"
export const ALL_PHASES: Phase[] = ["fetch", "track", "alerts", "vectors", "enrich"]
/** Un cron nunca cae exacto: una fuente «toca» si pasaron su cadencia menos esta tolerancia. */
export const SLACK_MINUTES = 20
/** Tras 3 fallos seguidos una fuente se considera degradada y solo se reintenta cada 12 h (no se insiste a una fuente caída). */
export const FAILURES_BEFORE_BACKOFF = 3
export const BACKOFF_HOURS = 12

/** `home` = solo desde una conexión residencial (el Mac): Get on Board responde 403 al cliente de Node desde GitHub y no se rodea ese bloqueo. */
export type Runner = "cloud" | "home"
export type Target = { id: string; label: string; everyHours: number; runner?: "home"; run: (db: Db) => Promise<SyncReport[]> }

export const TARGETS: Target[] = [
  { id: "getonboard", label: "Get on Board", everyHours: 3, run: async (db) => [await syncGetOnBoard(db)] },
  { id: "companies", label: "Empresas (Greenhouse, Lever, Ashby, Workable, Recruitee, SmartRecruiters, Personio)", everyHours: 6, run: (db) => syncAllCompanies(db) },
  ...PORTALS.map((p): Target => ({ id: `portal:${p.key}`, label: p.name, everyHours: 12, run: async (db) => [await syncPortal(db, p)] })),
  ...REMOTE_SOURCES.map((s): Target => ({ id: `remote:${s.key}`, label: s.name, everyHours: 12, run: async (db) => [await syncRemote(db, s.key)] })),
]

/** ¿Toca leer esta fuente? Pura (se prueba). `recent` = sus últimas corridas, la más nueva primero. */
export function isDue(everyHours: number, recent: { ok: boolean; at: Date }[], now: Date, force = false): boolean {
  if (force) return true
  const lastOk = recent.find((r) => r.ok)
  const sinceOk = lastOk ? now.getTime() - lastOk.at.getTime() : Infinity
  const failing = recent.length >= FAILURES_BEFORE_BACKOFF && recent.slice(0, FAILURES_BEFORE_BACKOFF).every((r) => !r.ok)
  if (failing && now.getTime() - recent[0].at.getTime() < BACKOFF_HOURS * 3_600_000) return false
  return sinceOk >= everyHours * 3_600_000 - SLACK_MINUTES * 60_000
}

async function recentRuns(db: Db, target: string) {
  const rows = await db.select({ ok: syncRuns.ok, at: syncRuns.finishedAt }).from(syncRuns).where(eq(syncRuns.target, target)).orderBy(desc(syncRuns.finishedAt)).limit(FAILURES_BEFORE_BACKOFF)
  return rows.filter((r) => r.at).map((r) => ({ ok: r.ok, at: new Date(r.at as string) }))
}

export type Health = { id: string; label: string; everyHours: number; active: boolean; lastOkAt: string | null; agoHours: number | null; lastError: string | null; failing: boolean; stale: boolean }
/** Estado de cada fuente para el panel y para que el workflow falle si algo clave lleva demasiado sin sincronizar. */
export async function syncHealth(db: Db, now = new Date(), catalog?: CatalogRow[]): Promise<Health[]> {
  const out: Health[] = []
  const cat = new Map((catalog ?? (await listCatalog(db))).map((r) => [r.key, r]))
  for (const t of TARGETS) {
    const eff = effective(cat.get(t.id), t.everyHours)
    const recent = await recentRuns(db, t.id)
    const lastOk = recent.find((r) => r.ok)
    const lastBad = (await db.select({ e: syncRuns.error }).from(syncRuns).where(and(eq(syncRuns.target, t.id), eq(syncRuns.ok, false))).orderBy(desc(syncRuns.finishedAt)).limit(1))[0]
    out.push({
      id: t.id,
      label: t.label,
      everyHours: eff.everyHours,
      active: eff.active,
      lastOkAt: lastOk?.at.toISOString() ?? null,
      agoHours: lastOk ? Math.max(1, Math.round((now.getTime() - lastOk.at.getTime()) / 3_600_000)) : null,
      lastError: recent[0] && !recent[0].ok ? (lastBad?.e ?? "sin detalle") : null,
      failing: recent.length >= FAILURES_BEFORE_BACKOFF && recent.every((r) => !r.ok),
      // «Atrasada» = sin éxito en 3 ciclos de su cadencia (mínimo 12 h).
      // Una fuente pausada a propósito nunca se marca «atrasada».
      stale: eff.active && (!lastOk || now.getTime() - lastOk.at.getTime() > Math.max(12, eff.everyHours * 3) * 3_600_000),
    })
  }
  return out
}

/** Ofertas activas sin vector (el workflow instala Ollama solo si hay algo que calcular). */
export async function pendingVectors(db: Db): Promise<number> {
  const r = (await db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(and(isNull(jobs.embedding), eq(jobs.status, "activa"))))[0]
  return r?.n ?? 0
}

export type DailyOptions = { runner?: Runner; force?: boolean; only?: string[]; phases?: Phase[]; holder?: string; enrichMinutes?: number; log?: (line: string) => void; now?: () => Date }
export type DailySummary = { locked?: boolean;  targets: { id: string; skipped?: boolean; ok?: boolean; created?: number; updated?: number; closed?: number; error?: string }[]; expired: Awaited<ReturnType<typeof expireStale>>; enriched: number; embedded: number; purgedEvents: number; tracked?: CheckSummary; alerts?: AlertRunSummary; ms: number }

export async function runDaily(db: Db, opts: DailyOptions = {}): Promise<DailySummary> {
  const t0 = Date.now()
  const log = opts.log ?? (() => {})
  const now = opts.now ?? (() => new Date())
  const phases = opts.phases?.length ? opts.phases : ALL_PHASES
  const summary: DailySummary = { targets: [], expired: { vencidas: 0, remotas: 0, portales: 0 }, enriched: 0, embedded: 0, purgedEvents: 0, ms: 0 }

  // Una sola corrida de lectura a la vez (GitHub Actions y el Mac comparten la base): si otra está en curso, esta se retira sin error.
  // La IA que estructura ofertas tiene su PROPIO candado: una tanda larga en el Mac no frena la lectura de fuentes en la nube.
  const holder = opts.holder ?? `run-${process.pid}-${Date.now()}`
  const needsMain = phases.includes("fetch") || phases.includes("vectors")
  if (needsMain && !(await acquireLock(db, holder))) {
    log("Otra sincronización está en curso: esta corrida se retira.")
    return { ...summary, locked: true, ms: Date.now() - t0 }
  }
  try {
    if (phases.includes("fetch")) {
      const catalog = new Map((await listCatalog(db)).map((r) => [r.key, r]))
      for (const t of TARGETS.filter((x) => (!opts.only?.length || opts.only.includes(x.id)) && !(opts.runner === "cloud" && x.runner === "home"))) {
        const eff = effective(catalog.get(t.id), t.everyHours)
        if (!eff.active) {
          log(`· ${t.label}: pausada en el catálogo de fuentes, se omite`)
          summary.targets.push({ id: t.id, skipped: true })
          continue
        }
        if (!isDue(eff.everyHours, await recentRuns(db, t.id), now(), opts.force)) {
          log(`· ${t.label}: no toca todavía (cada ${eff.everyHours} h) o está en pausa por fallos`)
          summary.targets.push({ id: t.id, skipped: true })
          continue
        }
        const startedAt = now()
        let reports: SyncReport[] = []
        try {
          reports = await t.run(db)
        } catch (e) {
          reports = [{ source: t.label, fetched: 0, outOfRegion: 0, duplicates: 0, created: 0, updated: 0, closed: 0, ms: 0, error: (e as Error).message }]
        }
        const sum = (k: "created" | "updated" | "closed" | "fetched") => reports.reduce((n, r) => n + (r[k] ?? 0), 0)
        const errors = reports.filter((r) => r.error).map((r) => `${r.source}: ${r.error}`.slice(0, 160))
        // «Con éxito» = al menos una lectura sin error (una empresa caída no invalida a las demás).
        const ok = reports.length > 0 && errors.length < reports.length
        await db.insert(syncRuns).values({ target: t.id, startedAt: startedAt.toISOString(), finishedAt: now().toISOString(), ok, fetched: sum("fetched"), created: sum("created"), updated: sum("updated"), closed: sum("closed"), error: errors.join(" | ").slice(0, 500) || null })
        log(`${ok ? "✓" : "✗"} ${t.label}: ${sum("created")} nuevas, ${sum("updated")} actualizadas, ${sum("closed")} cerradas${errors.length ? ` · ${errors.length} con error` : ""}`)
        summary.targets.push({ id: t.id, ok, created: sum("created"), updated: sum("updated"), closed: sum("closed"), error: errors[0] })
      }
      summary.expired = await expireStale(db).catch(() => summary.expired)
      log(`Vencimiento: ${summary.expired.vencidas} por vigencia, ${summary.expired.remotas} remotas sin verse, ${summary.expired.portales} de portales muy antiguas`)
      summary.purgedEvents = await purgeOld(db, true).catch(() => 0)
      // Foto diaria por fuente (idempotente: la última lectura del día queda como la foto); se conserva 400 días.
      const snap = await snapshotSourceStats(db).catch(() => 0)
      log(`Foto diaria: ${snap} fuentes`)
      await db.execute(sql`delete from public.source_daily_stats where day < (now() at time zone 'utc')::date - 400`).catch(() => {})
      // El historial de lecturas que ve el público dura 30 días.
      await db.delete(syncRuns).where(lt(syncRuns.finishedAt, sql`now() - interval '30 days'`)).catch(() => {})
    }

    if (phases.includes("vectors")) {
      for (let i = 0; i < 20; i++) {
        const r = await embedMissing(db, 120).catch(() => ({ done: 0, pending: 0 }))
        summary.embedded += r.done
        if (r.done === 0) break
      }
      log(`Vectores: ${summary.embedded} nuevos`)
    }
  } finally {
    if (needsMain) await releaseLock(db, holder).catch(() => {})
  }

  // Ofertas guardadas por las personas: ¿siguen abiertas? Solo lee los enlaces públicos; no necesita IA ni el candado principal.
  if (phases.includes("track")) {
    summary.tracked = await checkDueOffers(db, { probe: (u) => probeOfferLink(u), now: now(), log }).catch((e) => {
      log(`Ofertas guardadas: error (${(e as Error).message})`)
      return undefined
    })
    if (summary.tracked) log(`Ofertas guardadas: ${summary.tracked.urls} enlaces revisados (${summary.tracked.alive} abiertas, ${summary.tracked.dead} con señal de cierre, ${summary.tracked.unknown} sin poder verificar); ${summary.tracked.newlyClosed} pasaron a finalizada`)
  }

  // Alertas de las personas: ofertas nuevas del buscador que cumplen sus condiciones → avisos dentro de la app. Va DESPUÉS de leer las fuentes.
  if (phases.includes("alerts")) {
    summary.alerts = await runAlerts(db, now(), log).catch((e) => {
      log(`Alertas: error (${(e as Error).message})`)
      return undefined
    })
    if (summary.alerts) log(`Alertas: ${summary.alerts.alerts} revisadas, ${summary.alerts.newMatches} ofertas nuevas encontradas, ${summary.alerts.notifications} avisos, ${summary.alerts.paused} pausadas por inactividad`)
    await purgeMatches(db).catch(() => 0)
    await purgeNotifications(db).catch(() => 0)
  }

  if (phases.includes("enrich")) {
    const enrichHolder = `${holder}:enrich`
    const enrichTtl = (opts.enrichMinutes ?? 20) + 30
    if (!(await acquireLock(db, enrichHolder, enrichTtl, "sync-enrich"))) {
      log("Ya hay otra tanda de IA en curso: se omite.")
    } else {
      try {
        // IA local con presupuesto de tiempo: rondas de 5 hasta agotarlo, hasta que no queden pendientes o Ollama no responda.
        const deadline = Date.now() + (opts.enrichMinutes ?? 20) * 60_000
        while (Date.now() < deadline) {
          const r = await enrichPending(db, 5).catch(() => null)
          if (!r || r.processed === 0) {
            if (r?.stoppedBy) log(`IA local: se detuvo (${r.stoppedBy})`)
            break
          }
          summary.enriched += r.processed
          if (r.stoppedBy) {
            log(`IA local: se detuvo (${r.stoppedBy})`)
            break
          }
        }
        log(`IA local: ${summary.enriched} ofertas estructuradas`)
        // Lo que cambió al estructurar necesita vector nuevo.
        for (let i = 0; i < 10; i++) {
          const r = await embedMissing(db, 120).catch(() => ({ done: 0, pending: 0 }))
          summary.embedded += r.done
          if (r.done === 0) break
        }
      } finally {
        await releaseLock(db, enrichHolder, "sync-enrich").catch(() => {})
      }
    }
  }
  summary.ms = Date.now() - t0
  return summary
}
