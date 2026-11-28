import { and, desc, eq, gt, sql } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { jobs, syncRuns } from "@/lib/db/schema"
import { FAMILIES } from "@/lib/jobs/classify"
import { COUNTRIES } from "@/lib/jobs/geo"
import { listCatalog } from "./catalog"
import { activeTrend } from "./snapshots"
import { syncHealth, TARGETS, type Health } from "./schedule"

/**
 * Estado público de las fuentes de ofertas (para el panel «Fuentes» del buscador): qué fuente es, si está al día, cuántas ofertas activas
 * aporta y su historial de lecturas de los últimos 30 días. NUNCA expone errores crudos (pueden traer rutas, claves o detalles internos):
 * se traducen a mensajes simples con `friendlyError`.
 */
export const LOG_DAYS = 30
const LOG_PER_SOURCE = 12

/** `off` = pausada a propósito en el catálogo de fuentes */
export type SourceState = "ok" | "warn" | "late" | "paused" | "new" | "off"
export type LogEntry = { at: string; ok: boolean; message: string }
/** Datos útiles de una fuente para quien busca: qué tan frescas son sus ofertas y qué suelen traer. */
export type SourceStats = {
  /** entraron a Sooosh hace menos de 48 h */
  new48: number
  /** % de ofertas de tecnología, con salario publicado y remotas (0–100) */
  techPct: number
  salaryPct: number
  remotePct: number
  /** la oferta más reciente (fecha de publicación o, si no la dice, de entrada) */
  latestAt: string | null
  countries: { name: string; n: number }[]
  families: { name: string; n: number }[]
}
export type SourceStatus = {
  id: string
  name: string
  kind: "Plataforma" | "Empresas" | "Portal" | "Remotas"
  state: SourceState
  activeOffers: number
  lastOkAt: string | null
  everyHours: number
  /** qué es la fuente, en una frase, y su sitio (para «Visitar la fuente») */
  description: string
  home: string | null
  /** texto de atribución que piden los términos de la fuente */
  attribution: string
  stats: SourceStats
  /** ofertas activas por día (últimos 30 días, de la foto diaria) */
  trend: { day: string; n: number }[]
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

export function stateOf(h: Pick<Health, "failing" | "stale" | "lastError" | "lastOkAt"> & { active?: boolean }): SourceState {
  if (h.active === false) return "off"
  if (!h.lastOkAt && !h.lastError) return "new"
  if (h.failing) return "paused"
  if (h.stale) return "late"
  return h.lastError ? "warn" : "ok"
}

export const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0)

const INFO: Record<string, { description: string; home: string | null }> = {
  getonboard: { description: "Plataforma de empleo tech de Latinoamérica: cada oferta trae requisitos, modalidad y salario cuando la empresa los publica.", home: "https://www.getonbrd.com" },
  companies: { description: "Tableros de empleo que las propias empresas publican (Greenhouse, Lever, Ashby y otros): la oferta original, tal como la escribió la empresa.", home: null },
  "portal:chiletrabajos": { description: "Portal chileno de empleo. Traemos solo cargos de tecnología.", home: "https://www.chiletrabajos.cl" },
  "portal:trabajando": { description: "Portal chileno de empleo. Traemos solo cargos de tecnología.", home: "https://www.trabajando.cl" },
  "portal:magneto": { description: "Portal colombiano de empleo. Traemos solo cargos de tecnología.", home: "https://www.magneto365.com" },
  "remote:remotive": { description: "Ofertas remotas de empresas de todo el mundo; solo las abiertas a Latinoamérica.", home: "https://remotive.com" },
  "remote:jobicy": { description: "Ofertas remotas de todo el mundo; solo las abiertas a Latinoamérica.", home: "https://jobicy.com" },
  "remote:himalayas": { description: "Ofertas remotas de todo el mundo; solo las abiertas a Latinoamérica.", home: "https://himalayas.app" },
}
const countryName = (code: string | null) => COUNTRIES.find((c) => c.code === code)?.name ?? null
const familyName = (key: string | null) => (key && key in FAMILIES ? FAMILIES[key as keyof typeof FAMILIES] : null)

const kindOf = (id: string): SourceStatus["kind"] => (id === "getonboard" ? "Plataforma" : id === "companies" ? "Empresas" : id.startsWith("portal:") ? "Portal" : "Remotas")
const groupOf = (key: string | null): string | null => {
  if (!key) return null
  if (key === "getonboard" || key.startsWith("portal:") || key.startsWith("remote:")) return key
  return /^(greenhouse|lever|ashby|workable|recruitee|smartrecruiters|personio):/.test(key) ? "companies" : null
}

export async function sourceStatuses(db: Db, now = new Date()): Promise<SourceStatus[]> {
  const active = eq(jobs.status, "activa")
  const catalog = await listCatalog(db)
  const trend = await activeTrend(db).catch(() => new Map<string, { day: string; n: number }[]>())
  const [health, counts, countries, families, runs] = await Promise.all([
    syncHealth(db, now, catalog),
    db
      .select({
        key: jobs.sourceKey,
        company: sql<string>`max(${jobs.company})`,
        n: sql<number>`count(*)::int`,
        new48: sql<number>`count(*) filter (where ${jobs.createdAt} > now() - interval '48 hours')::int`,
        tech: sql<number>`count(*) filter (where ${jobs.isTech})::int`,
        salary: sql<number>`count(*) filter (where ${jobs.salary} is not null)::int`,
        remote: sql<number>`count(*) filter (where ${jobs.workMode} = 'remoto')::int`,
        latest: sql<string | null>`max(coalesce(${jobs.postedAt}, ${jobs.createdAt}))`,
      })
      .from(jobs)
      .where(active)
      .groupBy(jobs.sourceKey),
    db.select({ key: jobs.sourceKey, v: jobs.country, n: sql<number>`count(*)::int` }).from(jobs).where(active).groupBy(jobs.sourceKey, jobs.country),
    db.select({ key: jobs.sourceKey, v: jobs.roleFamily, n: sql<number>`count(*)::int` }).from(jobs).where(active).groupBy(jobs.sourceKey, jobs.roleFamily),
    db.select().from(syncRuns).where(and(gt(syncRuns.finishedAt, sql`now() - make_interval(days => ${LOG_DAYS})`))).orderBy(desc(syncRuns.finishedAt)),
  ])
  type Acc = { n: number; new48: number; tech: number; salary: number; remote: number; latest: string | null }
  const acc = new Map<string, Acc>()
  const companies: { name: string; offers: number }[] = []
  for (const c of counts) {
    const g = groupOf(c.key)
    if (!g) continue
    const a = acc.get(g) ?? { n: 0, new48: 0, tech: 0, salary: 0, remote: 0, latest: null }
    a.n += c.n
    a.new48 += c.new48
    a.tech += c.tech
    a.salary += c.salary
    a.remote += c.remote
    if (c.latest && (!a.latest || c.latest > a.latest)) a.latest = c.latest
    acc.set(g, a)
    if (g === "companies") companies.push({ name: c.company ?? c.key ?? "", offers: c.n })
  }
  const top = (rows: { key: string | null; v: string | null; n: number }[], g: string, label: (v: string | null) => string | null) => {
    const m = new Map<string, number>()
    for (const r of rows) {
      if (groupOf(r.key) !== g) continue
      const name = label(r.v)
      if (name) m.set(name, (m.get(name) ?? 0) + r.n)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, n]) => ({ name, n }))
  }
  return TARGETS.map((t) => {
    const h = health.find((x) => x.id === t.id)!
    const row = catalog.find((r) => r.key === t.id)
    const a = acc.get(t.id) ?? { n: 0, new48: 0, tech: 0, salary: 0, remote: 0, latest: null }
    const log = runs
      .filter((r) => r.target === t.id && r.finishedAt)
      .slice(0, LOG_PER_SOURCE)
      .map((r) => ({ at: new Date(r.finishedAt as string).toISOString(), ok: r.ok, message: describeRun(r) }))
    return {
      id: t.id,
      name: row?.name ?? (t.id === "companies" ? "Empresas con tablero público" : t.label),
      kind: row?.kind ?? kindOf(t.id),
      state: stateOf(h),
      activeOffers: a.n,
      lastOkAt: h.lastOkAt,
      everyHours: t.everyHours,
      description: row?.description ?? INFO[t.id]?.description ?? "",
      home: row ? row.homeUrl : (INFO[t.id]?.home ?? null),
      attribution: row?.attribution ?? "",
      stats: {
        new48: a.new48,
        techPct: pct(a.tech, a.n),
        salaryPct: pct(a.salary, a.n),
        remotePct: pct(a.remote, a.n),
        latestAt: a.latest ? new Date(a.latest).toISOString() : null,
        countries: top(countries, t.id, countryName),
        families: top(families, t.id, familyName),
      },
      trend: trend.get(t.id) ?? [],
      log,
      breakdown: t.id === "companies" ? companies.sort((x, y) => y.offers - x.offers).slice(0, 40) : undefined,
    }
  })
}
