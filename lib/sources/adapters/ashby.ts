import type { WorkMode } from "@/lib/jobs/draft"
import { SOURCE_HEADERS, type ExternalJob, type FetchResult, withRetry } from "../types"

/** Ashby: `api.ashbyhq.com/posting-api/job-board/{nombre}` (público, sin clave). Trae `applyUrl`, ubicaciones y si es remoto. */
type AbJob = {
  id: string
  title: string
  location?: string
  secondaryLocations?: { location?: string }[]
  employmentType?: string
  isRemote?: boolean
  workplaceType?: string
  publishedAt?: string
  jobUrl: string
  applyUrl?: string
  descriptionPlain?: string
  isListed?: boolean
  department?: string
  team?: string
}

const TYPES: Record<string, string> = { FullTime: "Tiempo completo", PartTime: "Medio tiempo", Intern: "Prácticas", Contract: "Contrato", Temporary: "Temporal" }
const WP: Record<string, WorkMode> = { remote: "remoto", hybrid: "hibrido", onsite: "presencial" }

export function mapAshbyJob(j: AbJob, name: string, company?: string): ExternalJob | null {
  if (!j.title || !j.jobUrl || j.isListed === false) return null
  const places = [...new Set([j.location, ...(j.secondaryLocations ?? []).map((s) => s.location)].filter((x): x is string => !!x))]
  const wp = j.workplaceType ? WP[j.workplaceType.toLowerCase()] : j.isRemote ? "remoto" : undefined
  return {
    sourceKey: `ashby:${name}`,
    sourceName: "ashby",
    externalId: j.id,
    url: j.jobUrl,
    applyUrl: j.applyUrl,
    title: j.title,
    company,
    locationText: places.join("; ") || undefined,
    workMode: wp,
    remote: wp ? wp === "remoto" : j.isRemote,
    department: [j.department, j.team].filter(Boolean).join(" / ") || undefined,
    employmentType: j.employmentType ? TYPES[j.employmentType] : undefined,
    postedAt: j.publishedAt,
    // descriptionPlain de Ashby ya separa párrafos con saltos de línea y listas con guiones
    description: (j.descriptionPlain ?? "").split("\n").map((l) => l.replace(/^\s*[-•*]\s+/, "• ").trim()).filter(Boolean).join("\n"),
  }
}

export async function fetchAshby(name: string, company?: string, opts: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {}): Promise<FetchResult> {
  const res = await withRetry(opts.fetchImpl ?? fetch)(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(name)}`, { headers: SOURCE_HEADERS, signal: opts.signal ?? AbortSignal.timeout(30_000) })
  if (res.status === 404) throw new Error(`No existe el tablero «${name}» en Ashby`)
  if (!res.ok) throw new Error(`Ashby respondió ${res.status}`)
  const d = (await res.json()) as { jobs?: AbJob[] }
  return { jobs: (d.jobs ?? []).map((j) => mapAshbyJob(j, name, company)).filter((x): x is ExternalJob => !!x), complete: true }
}
