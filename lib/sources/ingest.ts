import { and, eq, isNotNull, lt, ne, or, isNull, sql } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { jobs } from "@/lib/db/schema"
import { classifyRole, isTechFamily } from "@/lib/jobs/classify"
import type { JobDraft } from "@/lib/jobs/draft"

/** Guardado de ofertas por fuente. */
export type IngestItem = { draft: JobDraft; dedupe: string; externalId: string }
export type IngestResult = { created: number; updated: number; duplicates: number; closed: number }

const ex = (col: string) => sql.raw(`excluded."${col}"`)
const CHUNK = 100

/**
 * Guarda las ofertas de UNA fuente en bloques (una sola consulta por 100 ofertas: la base está lejos y una por oferta tardaría minutos).
 * - La clave es la dirección canónica: volver a verla actualiza, no duplica.
 * - La misma oferta que ya llegó de otra fuente o se cargó a mano (mismo título, empresa y país) se descarta.
 * - Lo que Juan ocultó sigue oculto; lo que estaba cerrado y reaparece se reactiva.
 * - Con `closeMissing` (la fuente se leyó completa), lo que ya no aparece se marca como cerrado.
 */
export async function ingest(db: Db, sourceKey: string, items: IngestItem[], opts: { closeMissing: boolean; startedAt: Date }): Promise<IngestResult> {
  const startedAt = opts.startedAt.toISOString()
  const mine = new Set((await db.select({ u: jobs.sourceUrl }).from(jobs).where(eq(jobs.sourceKey, sourceKey))).map((r) => r.u))
  const others = new Set(
    (await db.select({ k: jobs.dedupeKey }).from(jobs).where(and(eq(jobs.status, "activa"), isNotNull(jobs.dedupeKey), or(isNull(jobs.sourceKey), ne(jobs.sourceKey, sourceKey))))).map((r) => r.k as string),
  )
  const seenUrls = new Set<string>()
  const fresh: IngestItem[] = []
  let duplicates = 0
  for (const it of items) {
    if (seenUrls.has(it.draft.sourceUrl)) continue
    seenUrls.add(it.draft.sourceUrl)
    if (!mine.has(it.draft.sourceUrl) && others.has(it.dedupe)) {
      duplicates++
      continue
    }
    fresh.push(it)
  }

  let created = 0
  let updated = 0
  for (let i = 0; i < fresh.length; i += CHUNK) {
    const rows = fresh.slice(i, i + CHUNK).map(({ draft: d, dedupe, externalId }) => ({
      sourceUrl: d.sourceUrl,
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
      offer: d.offer,
      skills: d.skills,
      apply: d.apply,
      salary: d.salary ?? null,
      postedAt: d.postedAt ?? null,
      validThrough: d.validThrough ?? null,
      roleFamily: (d.roleFamily ?? classifyRole({ title: d.title, skills: d.skills }).family) as string,
      isTech: isTechFamily(d.roleFamily ?? classifyRole({ title: d.title, skills: d.skills }).family),
      sourceKey,
      externalId,
      dedupeKey: dedupe,
      origin: "feed",
      lastSeenAt: startedAt,
    }))
    const res = await db
      .insert(jobs)
      .values(rows)
      .onConflictDoUpdate({
        target: jobs.sourceUrl,
        set: {
          sourceName: ex("source_name"),
          title: ex("title"),
          company: ex("company"),
          locationText: ex("location_text"),
          country: ex("country"),
          regions: ex("regions"),
          workMode: ex("work_mode"),
          remoteScope: ex("remote_scope"),
          employmentType: ex("employment_type"),
          seniority: ex("seniority"),
          language: ex("language"),
          offer: ex("offer"),
          skills: ex("skills"),
          apply: ex("apply"),
          salary: ex("salary"),
          postedAt: ex("posted_at"),
          validThrough: ex("valid_through"),
          roleFamily: ex("role_family"),
          isTech: ex("is_tech"),
          sourceKey: ex("source_key"),
          externalId: ex("external_id"),
          dedupeKey: ex("dedupe_key"),
          lastSeenAt: ex("last_seen_at"),
          // el vector solo se recalcula si cambió el contenido
          embedding: sql`case when ${jobs.offer} is distinct from excluded."offer" then null else ${jobs.embedding} end`,
          // lo que Juan ocultó sigue oculto; lo cerrado que reaparece se reactiva
          status: sql`case when ${jobs.status} = 'oculta' then 'oculta' else 'activa' end`,
        },
      })
      .returning({ inserted: sql<boolean>`(xmax = 0)` })
    for (const r of res) {
      if (r.inserted) created++
      else updated++
    }
  }

  let closed = 0
  if (opts.closeMissing && seenUrls.size > 0) {
    const gone = await db
      .update(jobs)
      .set({ status: "cerrada" })
      .where(and(eq(jobs.sourceKey, sourceKey), eq(jobs.status, "activa"), or(isNull(jobs.lastSeenAt), lt(jobs.lastSeenAt, startedAt))))
      .returning({ id: jobs.id })
    closed = gone.length
  }
  return { created, updated, duplicates, closed }
}
