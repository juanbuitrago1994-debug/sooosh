import { and, desc, eq, gt, inArray, isNull, or, sql, type SQL } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { jobs } from "@/lib/db/schema"
import type { Offer } from "@/lib/schemas/offer"
import type { Apply } from "./apply"
import { WORK_MODES, type WorkMode } from "./draft"
import type { Salary } from "./salary"
import { LATAM_CODES } from "./geo"
import { ALL_REGIONS } from "./region"

/** Una tarjeta tal como la ve quien busca (sin el vector ni datos de administración). */
export type JobCard = {
  id: string
  title: string
  company: string | null
  locationText: string | null
  country: string | null
  regions: string[]
  workMode: WorkMode | null
  remoteScope: string | null
  employmentType: string | null
  seniority: string | null
  language: string | null
  skills: string[]
  apply: Apply | null
  salary: Salary | null
  sourceName: string
  sourceUrl: string
  postedAt: string | null
  createdAt: string
  isNew: boolean
  roleFamily: string | null
  isTech: boolean
  offer: Offer
}

/** `tecnologia` = solo cargos de tecnología (desarrollo, datos, diseño digital, producto, infraestructura…); `todas` = sin filtro. */
export type Area = "tecnologia" | "todas"
export type SearchParams = { region: string; q?: string; mode?: WorkMode; area?: Area; limit?: number; embedding?: number[]; /** vector del CV: sin texto de búsqueda, trae primero las ofertas más cercanas a la persona */ profileEmbedding?: number[] }
/** `total` = cuántas ofertas activas cumplen los filtros y el texto (no solo las de la página): es el número del distintivo «Ofertas encontradas». */
export type SearchResult = { jobs: JobCard[]; semantic: boolean; total: number }

/** Distancia coseno máxima para que un resultado semántico cuente como relacionado (bge-m3). Calibrado con 5 ofertas y 12 consultas (docs/BENCHMARKS.md): lo relevante queda en 0,39–0,52 y lo que no tiene relación en ≥ 0,57. Reajustar con ofertas reales. */
export const MAX_SEMANTIC_DISTANCE = 0.54
const RRF_K = 60

export const jobCols = {
  id: jobs.id,
  title: jobs.title,
  company: jobs.company,
  locationText: jobs.locationText,
  country: jobs.country,
  regions: jobs.regions,
  workMode: jobs.workMode,
  remoteScope: jobs.remoteScope,
  employmentType: jobs.employmentType,
  seniority: jobs.seniority,
  language: jobs.language,
  skills: jobs.skills,
  apply: jobs.apply,
  salary: jobs.salary,
  sourceName: jobs.sourceName,
  sourceUrl: jobs.sourceUrl,
  postedAt: jobs.postedAt,
  createdAt: jobs.createdAt,
  /** entró a Sooosh hace menos de 48 h (se calcula en la base: así no depende del reloj del navegador) */
  isNew: sql<boolean>`${jobs.createdAt} > now() - interval '48 hours'`,
  roleFamily: jobs.roleFamily,
  isTech: jobs.isTech,
  offer: jobs.offer,
}

/**
 * Filtro de región. «LATAM» = ofertas marcadas LATAM. Un país = ofertas de ese país + las REMOTAS abiertas a toda Latinoamérica
 * (sin país propio): una oferta presencial de México no debe salirle a quien busca en Colombia.
 */
export function regionFilter(region: string): SQL | undefined {
  if (!region || region === ALL_REGIONS) return undefined
  // Una tarjeta marcada «TODAS» (cargada a mano, sin región conocida) aparece en cualquier región.
  const open = sql`${jobs.regions} @> ARRAY[${ALL_REGIONS}]::text[]`
  if (region === "LATAM") return sql`(${jobs.regions} @> ARRAY['LATAM']::text[] OR ${open})`
  // Las ofertas remotas «para toda Latinoamérica» solo valen para quien busca desde un país latinoamericano (no desde EE. UU. ni España).
  if (!LATAM_CODES.has(region)) return sql`(${jobs.regions} @> ARRAY[${region}]::text[] OR ${open})`
  return sql`(${jobs.regions} @> ARRAY[${region}]::text[] OR ${open} OR (${jobs.workMode} = 'remoto' AND ${jobs.country} IS NULL AND ${jobs.regions} @> ARRAY['LATAM']::text[]))`
}

const base = (p: SearchParams) =>
  and(
    eq(jobs.status, "activa"),
    or(isNull(jobs.validThrough), gt(jobs.validThrough, sql`now()`)),
    regionFilter(p.region),
    p.mode && (WORK_MODES as readonly string[]).includes(p.mode) ? eq(jobs.workMode, p.mode) : undefined,
    p.area === "tecnologia" ? eq(jobs.isTech, true) : undefined,
  )

const countWhere = async (db: Db, where: SQL | undefined): Promise<number> => (await db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(where))[0]?.n ?? 0

/** Columna generada `jobs.search` (tsvector): vive solo en la base, no en el esquema tipado. */
const SEARCH = sql.raw("jobs.search")

const unaccent = (v: SQL | string) => sql`public.f_unaccent(${v})`

type Row = Omit<JobCard, "workMode" | "offer" | "apply" | "salary"> & { workMode: string | null; offer: unknown; apply: unknown; salary: unknown }
export const toCard = (r: Row): JobCard => ({ ...r, workMode: r.workMode as WorkMode | null, offer: r.offer as Offer, apply: (r.apply as Apply | null) ?? null, salary: (r.salary as Salary | null) ?? null })

/** Mezcla dos listas ordenadas (texto y significado) con Reciprocal Rank Fusion: lo que aparece alto en ambas, gana. */
export function fuse<T extends { id: string }>(lists: T[][]): T[] {
  const score = new Map<string, number>()
  const item = new Map<string, T>()
  for (const list of lists) {
    list.forEach((it, i) => {
      score.set(it.id, (score.get(it.id) ?? 0) + 1 / (RRF_K + i + 1))
      if (!item.has(it.id)) item.set(it.id, it)
    })
  }
  return [...item.values()].sort((a, b) => (score.get(b.id) ?? 0) - (score.get(a.id) ?? 0))
}

export async function searchJobs(db: Db, p: SearchParams): Promise<SearchResult> {
  const limit = Math.min(Math.max(p.limit ?? 30, 1), 200)
  const q = p.q?.trim().slice(0, 120)
  if (!q) {
    const byProfile = p.profileEmbedding?.length ? sql`${jobs.embedding} <=> ${sql`${JSON.stringify(p.profileEmbedding)}::extensions.vector`} asc nulls last` : null
    const [rows, total] = await Promise.all([
      db.select(jobCols).from(jobs).where(base(p)).orderBy(byProfile ?? sql`coalesce(${jobs.postedAt}, ${jobs.createdAt}) desc`).limit(limit),
      countWhere(db, base(p)),
    ])
    return { jobs: rows.map(toCard), semantic: false, total }
  }
  // Texto: palabras (sin tildes, con raíces en español) o fragmento del título/empresa («dise» encuentra «Diseñador»).
  const tsq = sql`websearch_to_tsquery('spanish', ${unaccent(q)})`
  const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`
  const textWhere = or(sql`${SEARCH} @@ ${tsq}`, sql`${unaccent(sql`${jobs.title} || ' ' || coalesce(${jobs.company}, '')`)} ilike ${unaccent(like)}`)
  const [lexical, lexicalTotal] = await Promise.all([
    db
      .select(jobCols)
      .from(jobs)
      .where(and(base(p), textWhere))
      .orderBy(sql`ts_rank(${SEARCH}, ${tsq}) desc`, desc(jobs.createdAt))
      .limit(limit),
    countWhere(db, and(base(p), textWhere)),
  ])
  let semantic: typeof lexical = []
  if (p.embedding?.length) {
    const vec = sql`${JSON.stringify(p.embedding)}::extensions.vector`
    semantic = await db
      .select(jobCols)
      .from(jobs)
      .where(and(base(p), sql`${jobs.embedding} IS NOT NULL`, sql`(${jobs.embedding} <=> ${vec}) < ${MAX_SEMANTIC_DISTANCE}`))
      .orderBy(sql`${jobs.embedding} <=> ${vec}`)
      .limit(limit)
  }
  const merged = fuse([lexical, semantic]).slice(0, limit)
  // El conteo es el del texto; si el significado trajo más de lo que el texto encontró, no se muestra un total menor que lo que se ve.
  return { jobs: merged.map(toCard), semantic: !!p.embedding?.length, total: Math.max(lexicalTotal, merged.length) }
}

/** Total de ofertas activas y vigentes de toda la plataforma (sin región, área ni modalidad): el número del distintivo antes de que alguien busque o filtre. */
export const countPlatformJobs = (db: Db): Promise<number> => countWhere(db, base({ region: ALL_REGIONS, area: "todas" }))

/** Varias ofertas activas por id (las guardadas de una persona), en el orden pedido. */
export async function getJobCards(db: Db, ids: string[]): Promise<JobCard[]> {
  if (ids.length === 0) return []
  const rows = await db.select(jobCols).from(jobs).where(and(inArray(jobs.id, ids), eq(jobs.status, "activa")))
  const byId = new Map(rows.map((r) => [r.id, toCard(r)]))
  return ids.map((i) => byId.get(i)).filter((j): j is JobCard => !!j)
}

/** Una oferta activa por id (para su página de detalle). null si no existe o no está activa. */
export async function getJobCard(db: Db, id: string): Promise<JobCard | null> {
  const row = (await db.select(jobCols).from(jobs).where(and(eq(jobs.id, id), eq(jobs.status, "activa"))).limit(1))[0]
  return row ? toCard(row) : null
}
