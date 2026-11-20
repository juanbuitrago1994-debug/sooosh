import type { WorkMode } from "@/lib/jobs/draft"
import { htmlListItems, htmlToLines } from "../text"
import { SOURCE_HEADERS, type ExternalJob, type FetchResult, withRetry } from "../types"

/** Recruitee: `{empresa}.recruitee.com/api/offers/` (público, sin clave). Trae descripción y requisitos por separado. */
type RcOffer = {
  id: number | string
  title?: string
  careers_url?: string
  careers_apply_url?: string
  description?: string
  requirements?: string
  department?: string
  country?: string
  country_code?: string
  city?: string
  location?: string
  remote?: boolean
  hybrid?: boolean
  on_site?: boolean
  employment_type_code?: string
  experience_code?: string
  published_at?: string
  close_at?: string | null
  company_name?: string
  status?: string
  salary?: { min?: number | null; max?: number | null; currency?: string | null; period?: string | null }
}

const EMPLOYMENT: [RegExp, string][] = [
  [/fulltime|full_time/i, "Tiempo completo"],
  [/parttime|part_time/i, "Medio tiempo"],
  [/intern/i, "Prácticas"],
  [/contract|freelance|temporary/i, "Contrato"],
]

export function mapRecruiteeOffer(o: RcOffer, slug: string, company?: string): ExternalJob | null {
  if (!o.title || !o.careers_url || (o.status && o.status !== "published")) return null
  const mode: WorkMode | undefined = o.remote ? "remoto" : o.hybrid ? "hibrido" : o.on_site ? "presencial" : undefined
  const requirements = htmlListItems(o.requirements)
  return {
    sourceKey: `recruitee:${slug}`,
    sourceName: "recruitee",
    externalId: String(o.id),
    url: o.careers_url,
    applyUrl: o.careers_apply_url ?? o.careers_url,
    title: o.title,
    company: o.company_name ?? company,
    locationText: o.location || [o.city, o.country].filter(Boolean).join(", ") || undefined,
    countries: o.country_code ? [o.country_code] : undefined,
    workMode: mode,
    remote: mode ? mode === "remoto" : undefined,
    department: o.department || undefined,
    employmentType: EMPLOYMENT.find(([re]) => re.test(o.employment_type_code ?? ""))?.[1],
    postedAt: o.published_at ? o.published_at.replace(" UTC", "Z").replace(" ", "T") : undefined,
    validThrough: o.close_at ? o.close_at.replace(" UTC", "Z").replace(" ", "T") : undefined,
    description: [...htmlToLines(o.description), ...(requirements.length ? ["Requisitos", ...requirements.map((x) => `• ${x}`)] : [])].join("\n"),
    structured: requirements.length ? { requirements } : undefined,
  }
}

export async function fetchRecruitee(slug: string, company?: string, opts: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {}): Promise<FetchResult> {
  const res = await withRetry(opts.fetchImpl ?? fetch)(`https://${encodeURIComponent(slug)}.recruitee.com/api/offers/`, { headers: SOURCE_HEADERS, signal: opts.signal ?? AbortSignal.timeout(30_000) })
  if (res.status === 404) throw new Error(`No existe la empresa «${slug}» en Recruitee`)
  if (!res.ok) throw new Error(`Recruitee respondió ${res.status}`)
  const d = (await res.json()) as { offers?: RcOffer[] }
  return { jobs: (d.offers ?? []).map((o) => mapRecruiteeOffer(o, slug, company)).filter((x): x is ExternalJob => !!x), complete: true }
}
