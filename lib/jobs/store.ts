import { and, count, desc, eq, inArray, ne, or, sql } from "drizzle-orm"
import { z } from "zod"
import type { Db } from "@/lib/db"
import { jobs } from "@/lib/db/schema"
import { offerSchema } from "@/lib/schemas/offer"
import { APPLY_METHODS } from "./apply"
import { classifyRole, FAMILIES, isTechFamily, type Family } from "./classify"
import { WORK_MODES, type JobDraft } from "./draft"
import { CURRENCIES, PERIODS } from "./salary"

export const JOB_STATUSES = ["activa", "cerrada", "oculta"] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined))
const applyChannelSchema = z.object({ method: z.enum(APPLY_METHODS), platform: opt(60), url: opt(600), email: opt(200) })

/** Lo que el panel de administración envía para guardar una tarjeta (ya revisada y posiblemente corregida por Juan). */
export const jobDraftSchema = z.object({
  sourceUrl: z.string().trim().min(1).max(600),
  sourceName: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(200),
  company: opt(200),
  locationText: opt(200),
  country: opt(2),
  regions: z.array(z.string().trim().min(2).max(10)).max(12).default([]),
  workMode: z.enum(WORK_MODES).optional(),
  remoteScope: opt(300),
  employmentType: opt(60),
  seniority: opt(40),
  language: z.enum(["es", "en", "otro"]),
  offer: offerSchema,
  skills: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  apply: applyChannelSchema
    .extend({ alt: z.array(applyChannelSchema).max(3).optional() })
    .default({ method: "desconocido", platform: undefined, url: undefined, email: undefined }),
  salary: z
    .object({ min: z.number().positive().optional(), max: z.number().positive().optional(), currency: z.enum(CURRENCIES), period: z.enum(PERIODS) })
    .refine((s) => !!(s.min || s.max))
    .optional(),
  roleFamily: z.enum(Object.keys(FAMILIES) as [Family, ...Family[]]).optional(),
  postedAt: opt(40),
  validThrough: opt(40),
})

/** Guarda la tarjeta; si ya existía (misma dirección canónica) la actualiza en vez de duplicarla. */
export async function upsertJob(db: Db, d: JobDraft): Promise<{ id: string; created: boolean }> {
  const existing = (await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.sourceUrl, d.sourceUrl)).limit(1))[0]
  const row = {
    sourceName: d.sourceName,
    title: d.title,
    company: d.company ?? null,
    locationText: d.locationText ?? null,
    country: d.country ?? null,
    regions: d.regions,
    workMode: d.workMode ?? null,
    remoteScope: d.remoteScope ?? null,
    employmentType: d.employmentType ?? null,
    seniority: d.seniority ?? null,
    language: d.language,
    offer: { ...d.offer, title: d.title },
    skills: d.skills,
    apply: d.apply,
    salary: d.salary ?? null,
    // Siempre se deduce del título y las habilidades FINALES: si se corrigió el título al revisar, la familia (y «tecnología») se recalcula.
    roleFamily: classifyRole({ title: d.title, skills: d.skills }).family as string,
    isTech: isTechFamily(classifyRole({ title: d.title, skills: d.skills }).family),
    postedAt: d.postedAt ?? null,
    validThrough: d.validThrough ?? null,
    // El contenido cambió: el embedding viejo ya no vale (se recalcula en el paso del buscador).
    embedding: null,
  }
  if (existing) {
    await db.update(jobs).set(row).where(eq(jobs.id, existing.id))
    return { id: existing.id, created: false }
  }
  const [r] = await db.insert(jobs).values({ sourceUrl: d.sourceUrl, ...row }).returning({ id: jobs.id })
  return { id: r.id, created: true }
}

export async function findJobByUrl(db: Db, sourceUrl: string): Promise<{ id: string; title: string; status: string } | null> {
  const r = (await db.select({ id: jobs.id, title: jobs.title, status: jobs.status }).from(jobs).where(eq(jobs.sourceUrl, sourceUrl)).limit(1))[0]
  return r ?? null
}

export type JobListFilter = { status?: JobStatus[]; limit?: number; /** texto en el título o la empresa */ q?: string; /** incompletas: sin empresa, sin región o sin ubicación · ocultas: apagadas o cerradas */ only?: "incompletas" | "ocultas" }

const listWhere = (o: JobListFilter) => {
  const like = o.q?.trim() ? `%${o.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%` : undefined
  return and(
    o.status?.length ? inArray(jobs.status, o.status) : undefined,
    like ? sql`public.f_unaccent(${jobs.title} || ' ' || coalesce(${jobs.company}, '')) ilike public.f_unaccent(${like})` : undefined,
    o.only === "incompletas" ? or(sql`${jobs.company} is null`, sql`cardinality(${jobs.regions}) = 0`, sql`(${jobs.locationText} is null and ${jobs.country} is null)`) : undefined,
    o.only === "ocultas" ? ne(jobs.status, "activa") : undefined,
  )
}

/** Cuántas tarjetas cumplen el filtro (el listado trae solo las primeras). */
export async function countJobs(db: Db, o: JobListFilter = {}): Promise<number> {
  const [r] = await db.select({ n: count() }).from(jobs).where(listWhere(o))
  return Number(r?.n ?? 0)
}

/** Listado para el panel (las más nuevas primero). No trae la oferta completa ni el embedding. */
export async function listJobs(db: Db, opts: JobListFilter = {}) {
  const q = db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: jobs.company,
      locationText: jobs.locationText,
      country: jobs.country,
      regions: jobs.regions,
      workMode: jobs.workMode,
      status: jobs.status,
      sourceName: jobs.sourceName,
      sourceUrl: jobs.sourceUrl,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(listWhere(opts))
    .orderBy(desc(jobs.createdAt))
    .limit(Math.min(opts.limit ?? 100, 200))
  return q
}

export async function setJobStatus(db: Db, id: string, status: JobStatus): Promise<boolean> {
  const r = await db.update(jobs).set({ status }).where(eq(jobs.id, id)).returning({ id: jobs.id })
  return r.length > 0
}

export async function deleteJob(db: Db, id: string): Promise<boolean> {
  const r = await db.delete(jobs).where(eq(jobs.id, id)).returning({ id: jobs.id })
  return r.length > 0
}
