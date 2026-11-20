import { and, desc, eq } from "drizzle-orm"
import type { Db } from "@/lib/db"
import { sourceCompanies } from "@/lib/db/schema"

export type Ats = "greenhouse" | "lever" | "ashby" | "workable" | "recruitee" | "smartrecruiters" | "personio"
/** Sistemas de selección con API pública de tableros. */
export const ATS_LIST: Ats[] = ["greenhouse", "lever", "ashby", "workable", "recruitee", "smartrecruiters", "personio"]
export const ATS_NAME: Record<Ats, string> = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", workable: "Workable", recruitee: "Recruitee", smartrecruiters: "SmartRecruiters", personio: "Personio" }

export const TOKEN_RE = /^[a-z0-9][a-z0-9_.-]{1,59}$/i

/** Del enlace de una oferta o de un tablero → de qué sistema de selección es y cuál es el nombre del tablero de la empresa. */
export function parseAtsUrl(raw: string): { ats: Ats; token: string } | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase()
  const seg = u.pathname.split("/").filter(Boolean)
  let hit: { ats: Ats; token: string } | null = null
  if (/(^|\.)greenhouse\.io$/.test(host)) {
    const t = host.startsWith("boards-api.") ? seg[2] : seg[0] // /v1/boards/{token}/jobs | /{token}/jobs/{id}
    if (t) hit = { ats: "greenhouse", token: t }
  } else if (host === "jobs.lever.co" || host === "api.lever.co") {
    const t = host === "api.lever.co" ? seg[2] : seg[0] // /v0/postings/{site} | /{site}/{id}
    if (t) hit = { ats: "lever", token: t }
  } else if (host === "jobs.ashbyhq.com" || host === "api.ashbyhq.com") {
    const t = host === "api.ashbyhq.com" ? seg[2] : seg[0] // /posting-api/job-board/{name} | /{name}/{id}
    if (t) hit = { ats: "ashby", token: t }
  }
  else if (host === "apply.workable.com" || host.endsWith(".workable.com")) {
    const t = host === "apply.workable.com" ? (seg[0] === "api" ? seg[4] : seg[0]) : host.split(".")[0] // apply.workable.com/{cuenta}/j/… | {cuenta}.workable.com
    if (t && t !== "www" && t !== "apply") hit = { ats: "workable", token: t }
  } else if (host.endsWith(".recruitee.com") && host !== "www.recruitee.com") hit = { ats: "recruitee", token: host.split(".")[0] }
  else if (host === "jobs.smartrecruiters.com" || host === "careers.smartrecruiters.com" || host === "api.smartrecruiters.com") {
    const t = host === "api.smartrecruiters.com" ? seg[2] : seg[0] // /v1/companies/{empresa}/… | /{empresa}/{id}
    if (t) hit = { ats: "smartrecruiters", token: t }
  } else if (/\.jobs\.personio\.(de|com)$/.test(host)) hit = { ats: "personio", token: host.split(".")[0] }
  return hit && TOKEN_RE.test(hit.token) ? hit : null
}

export async function listCompanies(db: Db) {
  return db.select().from(sourceCompanies).orderBy(desc(sourceCompanies.createdAt))
}

/** Agrega una empresa al directorio (si ya estaba, no hace nada). `created` indica si era nueva. */
export async function addCompany(db: Db, c: { ats: Ats; token: string; name?: string; note?: string }): Promise<{ id: string; created: boolean }> {
  const existing = (await db.select({ id: sourceCompanies.id }).from(sourceCompanies).where(and(eq(sourceCompanies.ats, c.ats), eq(sourceCompanies.token, c.token))).limit(1))[0]
  if (existing) return { id: existing.id, created: false }
  const [r] = await db.insert(sourceCompanies).values({ ats: c.ats, token: c.token, name: c.name ?? null, note: c.note ?? null }).returning({ id: sourceCompanies.id })
  return { id: r.id, created: true }
}

export async function removeCompany(db: Db, id: string): Promise<boolean> {
  return (await db.delete(sourceCompanies).where(eq(sourceCompanies.id, id)).returning({ id: sourceCompanies.id })).length > 0
}

export async function setCompanyActive(db: Db, id: string, active: boolean): Promise<boolean> {
  return (await db.update(sourceCompanies).set({ active }).where(eq(sourceCompanies.id, id)).returning({ id: sourceCompanies.id })).length > 0
}

export async function recordCompanySync(db: Db, id: string, status: string, count: number) {
  await db.update(sourceCompanies).set({ lastSyncedAt: new Date().toISOString(), lastStatus: status.slice(0, 200), lastCount: count }).where(eq(sourceCompanies.id, id))
}
