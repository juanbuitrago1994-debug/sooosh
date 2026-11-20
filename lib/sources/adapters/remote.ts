import { detectGeo, LATAM_CODES } from "@/lib/jobs/geo"
import { htmlToLines } from "../text"
import { SOURCE_HEADERS, sleep, type ExternalJob, type FetchResult, withRetry } from "../types"

/**
 * Fuentes de ofertas REMOTAS con API gratuita: Remotive, Jobicy y Himalayas. Sus términos piden lo mismo y aquí se cumple:
 *  · se muestra la fuente con enlace (la ficha dice «Fuente: …» y «ver la publicación original»);
 *  · el botón de postular lleva a la dirección que ellas entregan (nunca al sitio de la empresa);
 *  · las ofertas no se reenvían a otros agregadores;
 *  · pocas lecturas por día (Remotive pide ≤ 4).
 * Solo se conservan las abiertas a Latinoamérica: la restricción de ubicación debe decir «worldwide/anywhere», LATAM o un país de la región
 * (`normalize.ts` descarta el resto y fija el alcance).
 */
export const REMOTE_SOURCES = [
  { key: "remotive", name: "Remotive", home: "https://remotive.com" },
  { key: "jobicy", name: "Jobicy", home: "https://jobicy.com" },
  { key: "himalayas", name: "Himalayas", home: "https://himalayas.app" },
] as const
export type RemoteKey = (typeof REMOTE_SOURCES)[number]["key"]

/** ¿La restricción de ubicación deja postular desde Latinoamérica sin nombrar un país? («Worldwide», «Anywhere», «LATAM»…) */
export const OPEN_WORLD = /\b(worldwide|anywhere|global|everywhere|world[- ]wide|latam|latin america|latinoam|americas|south america)\b/i

/** Sin restricción escrita = abierta; con restricción, debe decir «worldwide/LATAM» o nombrar un país de la región («USA only» no sirve aunque el texto hable de Latinoamérica). */
export const openToLatam = (where: string) => !where.trim() || OPEN_WORLD.test(where) || detectGeo(where).countries.some((c) => LATAM_CODES.has(c))

const EMPLOYMENT: [RegExp, string][] = [
  [/full[-_ ]?time/i, "Tiempo completo"],
  [/part[-_ ]?time/i, "Medio tiempo"],
  [/intern/i, "Prácticas"],
  [/contract|freelance|temporary/i, "Contrato"],
]
const employment = (s?: string) => EMPLOYMENT.find(([re]) => re.test(s ?? ""))?.[1]
const iso = (v?: string | number) => (typeof v === "number" ? new Date(v * 1000).toISOString() : v ? new Date(v).toISOString() : undefined)

async function getJson<T>(url: string, opts: { fetchImpl?: typeof fetch; signal?: AbortSignal }): Promise<T> {
  const res = await withRetry(opts.fetchImpl ?? fetch)(url, { headers: SOURCE_HEADERS, signal: opts.signal ?? AbortSignal.timeout(45_000) })
  if (!res.ok) throw new Error(`${new URL(url).hostname} respondió ${res.status}`)
  return (await res.json()) as T
}

type Opts = { fetchImpl?: typeof fetch; signal?: AbortSignal; pauseMs?: number }

// ── Remotive
type RmJob = { id: number | string; url?: string; title?: string; company_name?: string; category?: string; tags?: string[]; job_type?: string; publication_date?: string; candidate_required_location?: string; description?: string }
export function mapRemotiveJob(j: RmJob): ExternalJob | null {
  if (!j.title || !j.url) return null
  const where = j.candidate_required_location ?? ""
  if (!openToLatam(where)) return null
  return {
    sourceKey: "remote:remotive",
    sourceName: "Remotive",
    externalId: String(j.id),
    url: j.url,
    applyUrl: j.url,
    title: j.title,
    company: j.company_name,
    locationText: where || undefined,
    countries: where ? [where] : undefined,
    remote: true,
    workMode: "remoto",
    assumeRemoteLatam: OPEN_WORLD.test(where),
    department: j.category,
    employmentType: employment(j.job_type),
    postedAt: iso(j.publication_date ? j.publication_date + "Z" : undefined),
    description: htmlToLines(j.description).join("\n"),
    structured: j.tags?.length ? { skills: j.tags.slice(0, 12) } : undefined,
  }
}
// Remotive cuelga las ofertas de tecnología en estas categorías (una sola lectura cada una).
const REMOTIVE_CATEGORIES = ["software-dev", "devops", "data", "qa", "product", "design"]
export async function fetchRemotive(opts: Opts = {}): Promise<FetchResult> {
  const out = new Map<string, ExternalJob>()
  for (const cat of REMOTIVE_CATEGORIES) {
    const d = await getJson<{ jobs?: RmJob[] }>(`https://remotive.com/api/remote-jobs?category=${cat}`, opts)
    for (const j of d.jobs ?? []) {
      const m = mapRemotiveJob(j)
      if (m) out.set(m.externalId, m)
    }
    await sleep(opts.pauseMs ?? 3000)
  }
  return { jobs: [...out.values()], complete: false }
}

// ── Jobicy
type JbJob = { id: number | string; url?: string; jobTitle?: string; companyName?: string; jobIndustry?: string[]; jobType?: string[]; jobGeo?: string; jobLevel?: string; jobDescription?: string; pubDate?: string; salaryMin?: number; salaryMax?: number; salaryCurrency?: string; salaryPeriod?: string }
const LEVEL: [RegExp, string][] = [[/junior|entry/i, "junior"], [/mid|semi/i, "semi-senior"], [/senior/i, "senior"], [/lead|principal|staff/i, "lead"], [/director|executive/i, "directivo"]]
export function mapJobicyJob(j: JbJob): ExternalJob | null {
  if (!j.jobTitle || !j.url) return null
  const geo = j.jobGeo ?? ""
  if (!openToLatam(geo)) return null
  const cur = (j.salaryCurrency ?? "").toUpperCase()
  const salary = j.salaryMin && ["USD", "EUR", "MXN", "COP", "CLP", "ARS", "BRL", "PEN"].includes(cur) && /year|annual/i.test(j.salaryPeriod ?? "") ? { min: j.salaryMin, max: j.salaryMax, currency: cur as "USD", period: "año" as const } : undefined
  return {
    sourceKey: "remote:jobicy",
    sourceName: "Jobicy",
    externalId: String(j.id),
    url: j.url,
    applyUrl: j.url,
    title: j.jobTitle,
    company: j.companyName,
    locationText: geo || undefined,
    countries: geo ? geo.split(/,\s*/) : undefined,
    remote: true,
    workMode: "remoto",
    assumeRemoteLatam: OPEN_WORLD.test(geo),
    department: j.jobIndustry?.join(" / "),
    employmentType: employment(j.jobType?.[0]),
    seniority: LEVEL.find(([re]) => re.test(j.jobLevel ?? ""))?.[1],
    salary,
    postedAt: iso(j.pubDate),
    description: htmlToLines(j.jobDescription).join("\n"),
  }
}
// Zonas que Jobicy reconoce (Colombia, Chile, Perú y Uruguay no existen como zona: devuelve 400). El filtro entrega solo lo abierto a esa zona.
const JOBICY_GEOS = ["latam", "anywhere", "argentina", "mexico"]
export async function fetchJobicy(opts: Opts = {}): Promise<FetchResult> {
  const out = new Map<string, ExternalJob>()
  const notes: string[] = []
  for (const geo of JOBICY_GEOS) {
    try {
      const d = await getJson<{ jobs?: JbJob[] }>(`https://jobicy.com/api/v2/remote-jobs?count=100&geo=${geo}`, opts)
      for (const j of d.jobs ?? []) {
        const m = mapJobicyJob(j)
        if (m) out.set(m.externalId, m)
      }
    } catch (e) {
      notes.push(`Jobicy (${geo}): ${(e as Error).message}`)
    }
    await sleep(opts.pauseMs ?? 4000) // Jobicy responde 429 si se le pide muy seguido
  }
  return { jobs: [...out.values()], complete: false, notes }
}

// ── Himalayas
type HmJob = { title?: string; companyName?: string; employmentType?: string; minSalary?: number | null; maxSalary?: number | null; salaryPeriod?: string; currency?: string | null; seniority?: string[]; locationRestrictions?: string[]; parentCategories?: string[]; description?: string; pubDate?: number | string; expiryDate?: number | string; applicationLink?: string; guid?: string }
export function mapHimalayasJob(j: HmJob): ExternalJob | null {
  const url = j.applicationLink ?? j.guid
  if (!j.title || !url) return null
  const places = j.locationRestrictions ?? []
  if (!openToLatam(places.join(", "))) return null
  const cur = (j.currency ?? "").toUpperCase()
  const salary = j.minSalary && /annual|year/i.test(j.salaryPeriod ?? "") && ["USD", "EUR", "MXN", "COP", "CLP", "ARS", "BRL", "PEN"].includes(cur) ? { min: j.minSalary, max: j.maxSalary ?? undefined, currency: cur as "USD", period: "año" as const } : undefined
  return {
    sourceKey: "remote:himalayas",
    sourceName: "Himalayas",
    externalId: j.guid ?? url,
    url,
    applyUrl: url,
    title: j.title,
    company: j.companyName,
    locationText: places.length ? places.join(", ") : "Remoto (cualquier país)",
    countries: places.length ? places : undefined,
    remote: true,
    workMode: "remoto",
    // Sin restricción de ubicación = abierta a todo el mundo.
    assumeRemoteLatam: places.length === 0 || places.some((p) => OPEN_WORLD.test(p)),
    department: j.parentCategories?.join(" / "),
    employmentType: employment(j.employmentType),
    seniority: LEVEL.find(([re]) => re.test(j.seniority?.[0] ?? ""))?.[1],
    salary,
    postedAt: iso(j.pubDate),
    validThrough: iso(j.expiryDate),
    description: htmlToLines(j.description).join("\n"),
  }
}
// Búsqueda por país (20 por página): trae lo abierto a ese país, incluidas las ofertas «worldwide».
const HIMALAYAS_COUNTRIES = ["CO", "AR", "CL", "MX", "PE", "UY"]
export async function fetchHimalayas(opts: Opts & { pages?: number } = {}): Promise<FetchResult> {
  const out = new Map<string, ExternalJob>()
  for (const cc of HIMALAYAS_COUNTRIES) {
    for (let page = 1; page <= (opts.pages ?? 5); page++) {
      const d = await getJson<{ jobs?: HmJob[] }>(`https://himalayas.app/jobs/api/search?country=${cc}&page=${page}`, opts)
      for (const j of d.jobs ?? []) {
        const m = mapHimalayasJob(j)
        if (m) out.set(m.externalId, m)
      }
      if (!d.jobs?.length || d.jobs.length < 20) break
      await sleep(opts.pauseMs ?? 3000)
    }
  }
  return { jobs: [...out.values()], complete: false }
}

export const REMOTE_FETCHERS: Record<RemoteKey, (o?: Opts) => Promise<FetchResult>> = { remotive: fetchRemotive, jobicy: fetchJobicy, himalayas: fetchHimalayas }
