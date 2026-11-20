import type { WorkMode } from "@/lib/jobs/draft"
import { htmlListItems, htmlToLines } from "../text"
import { SOURCE_HEADERS, sleep, type ExternalJob, type FetchResult, withRetry } from "../types"

/**
 * SmartRecruiters: `api.smartrecruiters.com/v1/companies/{empresa}/postings` (público, sin clave). El listado no trae el texto: se pide el detalle
 * SOLO de los avisos de Latinoamérica o remotos (una empresa global puede tener cientos y no hace falta leer los de otras regiones).
 */
type SrItem = {
  id: string
  name?: string
  releasedDate?: string
  location?: { city?: string; region?: string; country?: string; remote?: boolean; hybrid?: boolean; fullLocation?: string }
  department?: { label?: string }
  typeOfEmployment?: { label?: string }
  experienceLevel?: { label?: string }
  company?: { name?: string }
}
type SrDetail = SrItem & { postingUrl?: string; applyUrl?: string; jobAd?: { sections?: Record<string, { title?: string; text?: string } | undefined> } }

const LATAM = new Set(["ar", "bo", "br", "cl", "co", "cr", "do", "ec", "gt", "hn", "mx", "ni", "pa", "pe", "py", "sv", "uy", "ve", "pr"])
export const isRegionalPosting = (l?: SrItem["location"]) => !!l && (LATAM.has((l.country ?? "").toLowerCase()) || !!l.remote)

const EMPLOYMENT: [RegExp, string][] = [
  [/full/i, "Tiempo completo"],
  [/part/i, "Medio tiempo"],
  [/intern|pr[aá]ctic/i, "Prácticas"],
  [/contract|temporary|freelance/i, "Contrato"],
]

/** Nivel de SmartRecruiters → los valores de Sooosh (lo que no se reconoce se deja vacío: se deduce del título). */
const LEVEL: [RegExp, string][] = [
  [/intern|student/i, "practicante"],
  [/entry/i, "junior"],
  [/associate|junior/i, "junior"],
  [/mid[- ]?senior|senior/i, "senior"],
  [/director|executive/i, "directivo"],
]

export function mapSmartRecruitersJob(d: SrDetail, slug: string, company?: string): ExternalJob | null {
  const url = d.postingUrl
  if (!d.name || !url) return null
  const s = d.jobAd?.sections ?? {}
  const quals = htmlListItems(s.qualifications?.text)
  const duties = htmlListItems(s.jobDescription?.text)
  const l = d.location
  const mode: WorkMode | undefined = l?.remote ? "remoto" : l?.hybrid ? "hibrido" : undefined
  const description = [
    ...htmlToLines(s.jobDescription?.text),
    ...(s.qualifications?.text ? ["Qualifications", ...htmlToLines(s.qualifications.text)] : []),
    ...htmlToLines(s.additionalInformation?.text),
  ].join("\n")
  return {
    sourceKey: `smartrecruiters:${slug}`,
    sourceName: "smartrecruiters",
    externalId: d.id,
    url,
    applyUrl: d.applyUrl ?? url,
    title: d.name,
    company: d.company?.name ?? company,
    locationText: l?.fullLocation ?? ([l?.city, l?.country?.toUpperCase()].filter(Boolean).join(", ") || undefined),
    countries: l?.country ? [l.country.toUpperCase()] : undefined,
    workMode: mode,
    remote: l?.remote,
    department: d.department?.label,
    employmentType: EMPLOYMENT.find(([re]) => re.test(d.typeOfEmployment?.label ?? ""))?.[1],
    seniority: LEVEL.find(([re]) => re.test(d.experienceLevel?.label ?? ""))?.[1],
    postedAt: d.releasedDate,
    description,
    structured: quals.length || duties.length ? { requirements: quals, responsibilities: duties.length > 1 ? duties : undefined } : undefined,
  }
}

export async function fetchSmartRecruiters(slug: string, company?: string, opts: { fetchImpl?: typeof fetch; signal?: AbortSignal; pauseMs?: number; maxDetails?: number } = {}): Promise<FetchResult> {
  const f = withRetry(opts.fetchImpl ?? fetch)
  const base = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(slug)}/postings`
  const items: SrItem[] = []
  for (let offset = 0; offset < 2000; offset += 100) {
    const res = await f(`${base}?limit=100&offset=${offset}`, { headers: SOURCE_HEADERS, signal: opts.signal ?? AbortSignal.timeout(30_000) })
    if (res.status === 404) throw new Error(`No existe la empresa «${slug}» en SmartRecruiters`)
    if (!res.ok) throw new Error(`SmartRecruiters respondió ${res.status}`)
    const d = (await res.json()) as { content?: SrItem[]; totalFound?: number }
    items.push(...(d.content ?? []))
    if (items.length >= (d.totalFound ?? 0) || !(d.content?.length)) break
  }
  const wanted = items.filter((i) => isRegionalPosting(i.location)).slice(0, opts.maxDetails ?? 150)
  const jobs: ExternalJob[] = []
  for (const it of wanted) {
    await sleep(opts.pauseMs ?? 200)
    const res = await f(`${base}/${encodeURIComponent(it.id)}`, { headers: SOURCE_HEADERS, signal: opts.signal ?? AbortSignal.timeout(30_000) })
    if (!res.ok) continue
    const j = mapSmartRecruitersJob((await res.json()) as SrDetail, slug, company)
    if (j) jobs.push(j)
  }
  // Solo se leyeron los avisos de la región: no se puede cerrar lo que «no aparece» (podría ser de otra región).
  return { jobs, complete: false }
}
