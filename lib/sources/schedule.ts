import { and, desc, eq, isNull, sql } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { jobs, syncRuns } from "@/lib/db/schema"
import { enrichPending } from "@/lib/enrich/worker"
import { purgeOld } from "@/lib/events/server"
import { embedMissing } from "@/lib/jobs/embed"
import { expireStale } from "./expire"
import { acquireLock, releaseLock } from "./lock"
import { PORTALS, REMOTE_SOURCES, syncAllCompanies, syncGetOnBoard, syncPortal, syncRemote } from "./sync"
import type { SyncReport } from "./types"

/**
 * Sincronización automática. Corre desde GitHub Actions (cada 3 h, solo la fase «fetch» y los vectores) y desde el Mac (launchd, todo).
 * Cada fuente tiene su propia cadencia —respetuosa con ella— y se omite si se leyó con éxito hace menos de ese tiempo; así el cron puede
 * pasar cada 3 h sin que ninguna fuente se lea de más (Remotive pide ≤ 4 lecturas al día; Jobicy responde 429 si se abusa).
 */
export type Phase = "fetch" | "vectors" | "enrich"
export const ALL_PHASES: Phase[] = ["fetch", "vectors", "enrich"]
/** Un cron nunca cae exacto: una fuente «toca» si pasaron su cadencia menos esta tolerancia. */
export const SLACK_MINUTES = 20
/** Tras 3 fallos seguidos una fuente se considera degradada y solo se reintenta cada 12 h (no se insiste a una fuente caída). */
export const FAILURES_BEFORE_BACKOFF = 3
export const BACKOFF_HOURS = 12

/** `home` = solo desde una conexión residencial (el Mac): Get on Board responde 403 al cliente de Node desde GitHub y no se rodea ese bloqueo. */
export type Runner = "cloud" | "home"
export type Target = { id: string; label: string; everyHours: number; runner?: "home"; run: (db: Db) => Promise<SyncReport[]> }

export const TARGETS: Target[] = [
  { id: "getonboard", label: "Get on Board", everyHours: 3, runner: "home", run: async (db) => [await syncGetOnBoard(db)] },
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

export type Health = { id: string; label: string; everyHours: number; lastOkAt: string | null; agoHours: number | null; lastError: string | null; failing: boolean; stale: boolean }
/** Estado de cada fuente para el panel y para que el workflow falle si algo clave lleva demasiado sin sincronizar. */
export async function syncHealth(db: Db, now = new Date()): Promise<Health[]> {
  const out: Health[] = []
  for (const t of TARGETS) {
    const recent = await recentRuns(db, t.id)
    const lastOk = recent.find((r) => r.ok)
    const lastBad = (await db.select({ e: syncRuns.error }).from(syncRuns).where(and(eq(syncRuns.target, t.id), eq(syncRuns.ok, false))).orderBy(desc(syncRuns.finishedAt)).limit(1))[0]
    out.push({
      id: t.id,
      label: t.label,
      everyHours: t.everyHours,
      lastOkAt: lastOk?.at.toISOString() ?? null,
      agoHours: lastOk ? Math.max(1, Math.round((now.getTime() - lastOk.at.getTime()) / 3_600_000)) : null,
      lastError: recent[0] && !recent[0].ok ? (lastBad?.e ?? "sin detalle") : null,
      failing: recent.length >= FAILURES_BEFORE_BACKOFF && recent.every((r) => !r.ok),
      // «Atrasada» = sin éxito en 3 ciclos de su cadencia (mínimo 12 h).
      stale: !lastOk || now.getTime() - lastOk.at.getTime() > Math.max(12, t.everyHours * 3) * 3_600_000,
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
export type DailySummary = { locked?: boolean;  targets: { id: string; skipped?: boolean; ok?: boolean; created?: number; updated?: number; closed?: number; error?: string }[]; expired: Awaited<ReturnType<typeof expireStale>>; enriched: number; embedded: number; purgedEvents: number; ms: number }

export async function runDaily(db: Db, opts: DailyOptions = {}): Promise<DailySummary> {
  const t0 = Date.now()
  const log = opts.log ?? (() => {})
  const now = opts.now ?? (() => new Date())
  const phases = opts.phases?.length ? opts.phases : ALL_PHASES
  const summary: DailySummary = { targets: [], expired: { vencidas: 0, remotas: 0, portales: 0 }, enriched: 0, embedded: 0, purgedEvents: 0, ms: 0 }

  // Una sola corrida a la vez (GitHub Actions y el Mac comparten la base): si otra está en curso, esta se retira sin error.
  const holder = opts.holder ?? `run-${process.pid}-${Date.now()}`
  if (!(await acquireLock(db, holder))) {
    log("Otra sincronización está en curso: esta corrida se retira.")
    return { ...summary, locked: true, ms: Date.now() - t0 }
  }
  try {
    if (phases.includes("fetch")) {
      for (const t of TARGETS.filter((x) => (!opts.only?.length || opts.only.includes(x.id)) && !(opts.runner === "cloud" && x.runner === "home"))) {
        if (!isDue(t.everyHours, await recentRuns(db, t.id), now(), opts.force)) {
          log(`· ${t.label}: no toca todavía (cada ${t.everyHours} h) o está en pausa por fallos`)
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
    }

    if (phases.includes("vectors")) {
      for (let i = 0; i < 20; i++) {
        const r = await embedMissing(db, 120).catch(() => ({ done: 0, pending: 0 }))
        summary.embedded += r.done
        if (r.done === 0) break
      }
      log(`Vectores: ${summary.embedded} nuevos`)
    }

    if (phases.includes("enrich")) {
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
    }
  } finally {
    await releaseLock(db, holder).catch(() => {})
  }
  summary.ms = Date.now() - t0
  return summary
}
