import type { WorkMode } from "@/lib/jobs/draft"
import { htmlListItems } from "../text"
import { SOURCE_HEADERS, type ExternalJob, type FetchResult, withRetry } from "../types"

/** Lever: `api.lever.co/v0/postings/{sitio}?mode=json` (público, sin clave). Trae el enlace de postulación (`applyUrl`) y el país. */
type LvJob = {
  id: string
  text: string
  hostedUrl: string
  applyUrl?: string
  createdAt?: number
  country?: string
  workplaceType?: string
  categories?: { location?: string; commitment?: string; department?: string; team?: string; allLocations?: string[] }
  descriptionPlain?: string
  additionalPlain?: string
  lists?: { text: string; content: string }[]
}

const WORKPLACE: Record<string, WorkMode> = { remote: "remoto", hybrid: "hibrido", "on-site": "presencial", onsite: "presencial" }
const COMMITMENT: [RegExp, string][] = [
  [/full[- ]?time|tiempo completo/i, "Tiempo completo"],
  [/part[- ]?time|medio tiempo/i, "Medio tiempo"],
  [/intern|pr[aá]ctic/i, "Prácticas"],
  [/contract|freelance|contrato/i, "Contrato"],
]

export function mapLeverJob(j: LvJob, site: string, company?: string): ExternalJob | null {
  if (!j.text || !j.hostedUrl) return null
  const lists = j.lists ?? []
  const pick = (re: RegExp) => lists.filter((l) => re.test(l.text)).flatMap((l) => htmlListItems(l.content))
  const requirements = pick(/requisit|requirement|qu[eé] buscamos|perfil|qualif|what you|tu perfil/i)
  const responsibilities = pick(/responsab|funcion|desaf[ií]o|retos|qu[eé] har|what you.ll do|tareas|role/i)
  const nice = pick(/valoramos|deseable|plus|nice|bonus|valora/i)
  const description = [
    j.descriptionPlain ?? "",
    ...lists.flatMap((l) => [l.text, ...htmlListItems(l.content).map((x) => `• ${x}`)]),
    j.additionalPlain ?? "",
  ]
    .filter(Boolean)
    .join("\n")
  const places = [...new Set([j.categories?.location, ...(j.categories?.allLocations ?? [])].filter((x): x is string => !!x))]
  const wp = j.workplaceType ? WORKPLACE[j.workplaceType.toLowerCase()] : undefined
  return {
    sourceKey: `lever:${site}`,
    sourceName: "lever",
    externalId: j.id,
    url: j.hostedUrl,
    applyUrl: j.applyUrl,
    title: j.text,
    company,
    locationText: places.join("; ") || undefined,
    countries: j.country ? [j.country] : undefined,
    workMode: wp,
    remote: wp ? wp === "remoto" : undefined,
    department: [j.categories?.department, j.categories?.team].filter(Boolean).join(" / ") || undefined,
    employmentType: COMMITMENT.find(([re]) => re.test(j.categories?.commitment ?? ""))?.[1],
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : undefined,
    description,
    structured: requirements.length || responsibilities.length || nice.length ? { requirements, responsibilities, niceToHave: nice } : undefined,
  }
}

export async function fetchLever(site: string, company?: string, opts: { fetchImpl?: typeof fetch; signal?: AbortSignal } = {}): Promise<FetchResult> {
  const res = await withRetry(opts.fetchImpl ?? fetch)(`https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`, { headers: SOURCE_HEADERS, signal: opts.signal ?? AbortSignal.timeout(30_000) })
  if (res.status === 404) throw new Error(`No existe el tablero «${site}» en Lever`)
  if (!res.ok) throw new Error(`Lever respondió ${res.status}`)
  const d = (await res.json()) as LvJob[]
  return { jobs: (Array.isArray(d) ? d : []).map((j) => mapLeverJob(j, site, company)).filter((x): x is ExternalJob => !!x), complete: true }
}
