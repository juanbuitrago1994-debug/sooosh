import { and, desc, eq, gt, sql } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { jobs, syncRuns } from "@/lib/db/schema"
import { syncHealth, TARGETS, type Health } from "./schedule"

/**
 * Estado público de las fuentes de ofertas (para el panel «Fuentes» del buscador): qué fuente es, si está al día, cuántas ofertas activas
 * aporta y su historial de lecturas de los últimos 30 días. NUNCA expone errores crudos (pueden traer rutas, claves o detalles internos):
 * se traducen a mensajes simples con `friendlyError`.
 */
export const LOG_DAYS = 30
const LOG_PER_SOURCE = 12

export type SourceState = "ok" | "warn" | "late" | "paused" | "new"
export type LogEntry = { at: string; ok: boolean; message: string }
export type SourceStatus = {
  id: string
  name: string
  kind: "Plataforma" | "Empresas" | "Portal" | "Remotas"
  state: SourceState
  activeOffers: number
  lastOkAt: string | null
  everyHours: number
  log: LogEntry[]
  /** solo para «Empresas»: ofertas activas por empresa */
  breakdown?: { name: string; offers: number }[]
}

/** Error técnico → mensaje que una persona entiende. */
export function friendlyError(raw: string | null | undefined): string {
  const t = (raw ?? "").toLowerCase()
  if (!t) return "No se pudo leer esta fuente."
  if (/\b403\b|\b401\b|bloque|forbidden|robots/.test(t)) return "La fuente bloqueó la lectura."
  if (/\b429\b|too many|demasiad/.test(t)) return "La fuente pidió esperar (demasiadas lecturas seguidas)."
  if (/\b5\d\d\b|bad gateway|unavailable/.test(t)) return "La fuente tuvo un problema técnico."
  if (/timeout|timed out|abort|tard/.test(t)) return "La fuente tardó demasiado en responder."
  if (/\b404\b|no existe/.test(t)) return "La fuente ya no existe en esa dirección."
  return "No se pudo leer esta fuente."
}

/** Texto de una lectura del historial. Las de «Empresas» juntan varias: se cuentan las que no respondieron. */
export function describeRun(r: { ok: boolean; fetched: number; created: number; updated: number; closed: number; error: string | null }): string {
  const failedPart = r.error ? r.error.split(" | ").length : 0
  if (!r.ok) return friendlyError(r.error)
  // Cuenta las de la región (las que se guardaron): una empresa global lee miles de ofertas de las que casi todas quedan fuera.
  const n = r.created + r.updated
  const base = `Extrajo ${n} ${n === 1 ? "oferta" : "ofertas"} · ${r.created} ${r.created === 1 ? "nueva" : "nuevas"}, ${r.updated} ${r.updated === 1 ? "actualizada" : "actualizadas"}${r.closed ? `, ${r.closed} ${r.closed === 1 ? "cerrada" : "cerradas"}` : ""}`
  return failedPart > 0 ? `${base} · ${failedPart} ${failedPart === 1 ? "empresa no respondió" : "empresas no respondieron"}` : base
}

export function stateOf(h: Pick<Health, "failing" | "stale" | "lastError" | "lastOkAt">): SourceState {
  if (!h.lastOkAt && !h.lastError) return "new"
  if (h.failing) return "paused"
  if (h.stale) return "late"
  return h.lastError ? "warn" : "ok"
}

const kindOf = (id: string): SourceStatus["kind"] => (id === "getonboard" ? "Plataforma" : id === "companies" ? "Empresas" : id.startsWith("portal:") ? "Portal" : "Remotas")
const groupOf = (key: string | null): string | null => {
  if (!key) return null
  if (key === "getonboard" || key.startsWith("portal:") || key.startsWith("remote:")) return key
  return /^(greenhouse|lever|ashby|workable|recruitee|smartrecruiters|personio):/.test(key) ? "companies" : null
}

export async function sourceStatuses(db: Db, now = new Date()): Promise<SourceStatus[]> {
  const [health, counts, runs] = await Promise.all([
    syncHealth(db, now),
    db.select({ key: jobs.sourceKey, company: sql<string>`max(${jobs.company})`, n: sql<number>`count(*)::int` }).from(jobs).where(eq(jobs.status, "activa")).groupBy(jobs.sourceKey),
    db.select().from(syncRuns).where(and(gt(syncRuns.finishedAt, sql`now() - make_interval(days => ${LOG_DAYS})`))).orderBy(desc(syncRuns.finishedAt)),
  ])
  const totals = new Map<string, number>()
  const companies: { name: string; offers: number }[] = []
  for (const c of counts) {
    const g = groupOf(c.key)
    if (!g) continue
    totals.set(g, (totals.get(g) ?? 0) + c.n)
    if (g === "companies") companies.push({ name: c.company ?? c.key ?? "", offers: c.n })
  }
  return TARGETS.map((t) => {
    const h = health.find((x) => x.id === t.id)!
    const log = runs
      .filter((r) => r.target === t.id && r.finishedAt)
      .slice(0, LOG_PER_SOURCE)
      .map((r) => ({ at: new Date(r.finishedAt as string).toISOString(), ok: r.ok, message: describeRun(r) }))
    return {
      id: t.id,
      name: t.id === "companies" ? "Empresas con tablero público" : t.label,
      kind: kindOf(t.id),
      state: stateOf(h),
      activeOffers: totals.get(t.id) ?? 0,
      lastOkAt: h.lastOkAt,
      everyHours: t.everyHours,
      log,
      breakdown: t.id === "companies" ? companies.sort((a, b) => b.offers - a.offers).slice(0, 40) : undefined,
    }
  })
}
