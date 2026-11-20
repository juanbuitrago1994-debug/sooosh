import type { WorkMode } from "@/lib/jobs/draft"
import { htmlToLines } from "../text"
import { SOURCE_HEADERS, type ExternalJob, type FetchResult, withRetry } from "../types"

/** Workable: `apply.workable.com/api/v1/widget/accounts/{cuenta}?details=true` (público, sin clave). */
type WkJob = {
  title?: string
  shortcode?: string
  employment_type?: string
  telecommuting?: boolean
  department?: string
  url?: string
  shortlink?: string
  application_url?: string
  published_on?: string
  created_at?: string
  country?: string
  city?: string
  state?: string
  locations?: { country?: string; countryCode?: string; city?: string; region?: string; hidden?: boolean }[]
  description?: string
}

const EMPLOYMENT: [RegExp, string][] = [
  [/full/i, "Tiempo completo"],
  [/part/i, "Medio tiempo"],
  [/intern|pr[aá]ctic/i, "Prácticas"],
  [/contract|temporary|freelance/i, "Contrato"],
]

export function mapWorkableJob(j: WkJob, account: string, company?: string): ExternalJob | null {
  const url = j.url ?? j.shortlink
  if (!j.title || !url) return null
  const locs = (j.locations?.length ? j.locations.filter((l) => !l.hidden) : [{ country: j.country, city: j.city, region: j.state }])
  const places = [...new Set(locs.map((l) => [l.city, l.region, l.country].filter(Boolean).join(", ")).filter(Boolean))]
  const codes = [...new Set(locs.map((l) => ("countryCode" in l ? l.countryCode : undefined) ?? l.country).filter((x): x is string => !!x))]
  const mode: WorkMode | undefined = j.telecommuting ? "remoto" : undefined
  const lines = htmlToLines(j.description)
  return {
    sourceKey: `workable:${account}`,
    sourceName: "workable",
    externalId: j.shortcode ?? url,
    url,
    applyUrl: j.application_url ?? url,
    title: j.title,
    company,
    locationText: places.join("; ") || undefined,
    countries: codes.length ? codes : undefined,
    workMode: mode,
    remote: j.telecommuting,
    department: j.department || undefined,
    employmentType: EMPLOYMENT.find(([re]) => re.test(j.employment_type ?? ""))?.[1],
    postedAt: j.published_on ?? j.created_at,
    description: lines.join("\n"),
  }
}

export async function fetchWorkable(account: string, company?: string, opts: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {}): Promise<FetchResult> {
  const res = await withRetry(opts.fetchImpl ?? fetch)(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(account)}?details=true`, { headers: SOURCE_HEADERS, signal: opts.signal ?? AbortSignal.timeout(30_000) })
  if (res.status === 404) throw new Error(`No existe la cuenta «${account}» en Workable`)
  if (!res.ok) throw new Error(`Workable respondió ${res.status}`)
  const d = (await res.json()) as { name?: string; jobs?: WkJob[] }
  return { jobs: (d.jobs ?? []).map((j) => mapWorkableJob(j, account, company ?? d.name)).filter((x): x is ExternalJob => !!x), complete: true }
}
