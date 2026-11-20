import { eq } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { jobs } from "@/lib/db/schema"
import { queueEnrichment } from "@/lib/enrich/queue"
import { embedMissing } from "@/lib/jobs/embed"
import { fetchAshby } from "./adapters/ashby"
import { fetchGetOnBoard } from "./adapters/getonboard"
import { fetchGreenhouse } from "./adapters/greenhouse"
import { fetchLever } from "./adapters/lever"
import { fetchPersonio } from "./adapters/personio"
import { fetchRecruitee } from "./adapters/recruitee"
import { fetchSmartRecruiters } from "./adapters/smartrecruiters"
import { REMOTE_FETCHERS, REMOTE_SOURCES, type RemoteKey } from "./adapters/remote"
import { fetchWorkable } from "./adapters/workable"
import { fetchPortal, PORTALS, type PortalConfig } from "./portals/portal"
import { listCompanies, recordCompanySync, type Ats } from "./companies"
import type { JobDraft } from "@/lib/jobs/draft"
import { ingest, type IngestItem } from "./ingest"
import { externalToDraft } from "./normalize"
import { sleep, type FetchResult, type SyncReport } from "./types"

/** Lee una fuente, la normaliza, descarta lo que no es de Latinoamérica y guarda el resto. Nunca lanza: el error va en el informe. */
async function run(db: Db, source: string, sourceKey: string, fetcher: () => Promise<FetchResult>): Promise<SyncReport> {
  const t0 = Date.now()
  const startedAt = new Date()
  const report: SyncReport = { source, fetched: 0, outOfRegion: 0, duplicates: 0, created: 0, updated: 0, closed: 0, ms: 0 }
  try {
    const { jobs, complete } = await fetcher()
    report.fetched = jobs.length
    const items: IngestItem[] = []
    const texts: { draft: JobDraft; text: string }[] = []
    for (const j of jobs) {
      const n = externalToDraft(j)
      if (!n) report.outOfRegion++
      else {
        items.push({ draft: n.draft, dedupe: n.dedupe, externalId: j.externalId })
        texts.push({ draft: n.draft, text: n.text })
      }
    }
    // Una lectura vacía no cierra nada (podría ser un fallo de la fuente, no que no haya ofertas).
    const r = await ingest(db, sourceKey, items, { closeMissing: complete && jobs.length > 0, startedAt })
    Object.assign(report, r)
    // Las ofertas pobres (sin requisitos ni tareas) se encolan para que la IA las estructure; si la cola falla, la sincronización sigue.
    report.queued = (await queueEnrichment(db, texts).catch(() => ({ queued: 0 }))).queued
  } catch (e) {
    report.error = (e as Error).message
  }
  report.ms = Date.now() - t0
  return report
}

/** Portal sin API (Fase L4): lee solo ofertas nuevas de tecnología, hasta `maxPages` por corrida. */
export async function syncPortal(db: Db, cfg: PortalConfig, maxPages = 100, refresh = false): Promise<SyncReport> {
  const known = refresh ? new Set<string>() : new Set((await db.select({ u: jobs.sourceUrl }).from(jobs).where(eq(jobs.sourceKey, `portal:${cfg.key}`))).map((r) => r.u))
  const report = await run(db, cfg.name, `portal:${cfg.key}`, () => fetchPortal(cfg, { known, maxPages, onlyTech: true }))
  return report
}
export { PORTALS }

/** Fuente remota con API gratuita (Remotive, Jobicy, Himalayas). Pocas lecturas por día: sus términos lo piden. */
export async function syncRemote(db: Db, key: RemoteKey): Promise<SyncReport> {
  const s = REMOTE_SOURCES.find((x) => x.key === key)!
  return run(db, s.name, `remote:${key}`, () => REMOTE_FETCHERS[key]())
}
export { REMOTE_SOURCES }

export const syncGetOnBoard = (db: Db) => run(db, "Get on Board", "getonboard", () => fetchGetOnBoard())

export async function syncCompany(db: Db, c: { id: string; ats: Ats; token: string; name: string | null }): Promise<SyncReport> {
  const company = c.name ?? undefined
  const fetchers: Record<Ats, () => Promise<FetchResult>> = {
    greenhouse: () => fetchGreenhouse(c.token, company),
    lever: () => fetchLever(c.token, company ?? c.token),
    ashby: () => fetchAshby(c.token, company ?? c.token),
    workable: () => fetchWorkable(c.token, company ?? c.token),
    recruitee: () => fetchRecruitee(c.token, company ?? c.token),
    smartrecruiters: () => fetchSmartRecruiters(c.token, company ?? c.token),
    personio: () => fetchPersonio(c.token, company ?? c.token),
  }
  const r = await run(db, `${c.name ?? c.token} (${c.ats})`, `${c.ats}:${c.token}`, fetchers[c.ats])
  await recordCompanySync(db, c.id, r.error ? `Error: ${r.error}` : `Leídas ${r.fetched}; guardadas ${r.created + r.updated}`, r.created + r.updated).catch(() => {})
  return r
}

/** Todas las empresas activas del directorio, una tras otra con una pausa corta (cortesía con cada servicio). */
export async function syncAllCompanies(db: Db, pauseMs = process.env.VITEST ? 0 : 1200): Promise<SyncReport[]> {
  const out: SyncReport[] = []
  for (const c of (await listCompanies(db)).filter((x) => x.active)) {
    out.push(await syncCompany(db, { id: c.id, ats: c.ats as Ats, token: c.token, name: c.name }))
    await sleep(pauseMs)
  }
  return out
}

/** Calcula los vectores de las ofertas nuevas (un tanto por sincronización, para no tardar minutos; el resto se calcula en las siguientes o con /api/jobs/embed). */
export const embedAfterSync = (db: Db, limit = 120) => embedMissing(db, limit).catch(() => ({ done: 0, pending: 0 }))
