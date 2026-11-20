import { htmlToLines } from "../text"
import { SOURCE_HEADERS, type ExternalJob, type FetchResult, withRetry } from "../types"

/** Greenhouse: `boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true` (público, sin clave). Una empresa por llamada. */
type GhJob = {
  id: number | string
  title: string
  absolute_url: string
  location?: { name?: string }
  offices?: { name?: string; location?: string }[]
  updated_at?: string
  first_published?: string
  content?: string
  company_name?: string
  departments?: { name?: string }[]
}

export function mapGreenhouseJob(j: GhJob, token: string, company?: string): ExternalJob | null {
  if (!j.title || !j.absolute_url) return null
  const places = [j.location?.name, ...(j.offices ?? []).map((o) => o.location ?? o.name)].filter((x): x is string => !!x)
  const uniq = [...new Set(places.join("; ").split(/;\s*/).map((p) => p.trim()).filter(Boolean))]
  return {
    sourceKey: `greenhouse:${token}`,
    sourceName: "greenhouse",
    externalId: String(j.id),
    url: j.absolute_url,
    applyUrl: j.absolute_url,
    title: j.title,
    company: j.company_name ?? company,
    locationText: uniq.join("; ") || undefined,
    department: j.departments?.map((d) => d.name).filter(Boolean).join(" / ") || undefined,
    postedAt: j.first_published ?? j.updated_at,
    description: htmlToLines(j.content).join("\n"),
  }
}

export async function fetchGreenhouse(token: string, company?: string, opts: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {}): Promise<FetchResult> {
  const res = await withRetry(opts.fetchImpl ?? fetch)(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`, { headers: SOURCE_HEADERS, signal: opts.signal ?? AbortSignal.timeout(30_000) })
  if (res.status === 404) throw new Error(`No existe el tablero «${token}» en Greenhouse`)
  if (!res.ok) throw new Error(`Greenhouse respondió ${res.status}`)
  const d = (await res.json()) as { jobs?: GhJob[] }
  return { jobs: (d.jobs ?? []).map((j) => mapGreenhouseJob(j, token, company)).filter((x): x is ExternalJob => !!x), complete: true }
}
