import type { WorkMode } from "@/lib/jobs/draft"
import { htmlToLines, htmlListItems } from "../text"
import { SOURCE_HEADERS, sleep, type ExternalJob, type FetchResult, withRetry, fetchWithCurlFallback } from "../types"

/**
 * Get on Board (bolsa de empleo tech de Latinoamérica). API pública sin clave: `GET /api/v0/search/jobs` con `expand[]` para traer
 * empresa, nivel, modalidad y etiquetas. Se pagina de 100 en 100 con una pausa entre páginas. El filtro por país del servidor no
 * funciona, así que se trae todo y se filtra después (`normalize.ts`).
 * Su `description` son los requisitos, `functions` las responsabilidades y `desirable` lo deseable (listas HTML).
 * No entrega la moneda del salario, así que NO se muestra salario de esta fuente.
 */
const BASE = "https://www.getonbrd.com/api/v0/search/jobs"
const EXPAND = "expand%5B%5D=company&expand%5B%5D=seniority&expand%5B%5D=modality&expand%5B%5D=tags"
const MAX_PAGES = 15

type Rel = { data?: { attributes?: { name?: string; locale_key?: string } } } | undefined
type Item = {
  id: string
  attributes: Record<string, unknown> & { links?: unknown }
  links?: { public_url?: string }
}

const WORK_MODE: Record<string, WorkMode> = { fully_remote: "remoto", remote_local: "remoto", hybrid: "hibrido", no_remote: "presencial" }
const SENIORITY: Record<string, string> = { no_experience: "practicante", junior: "junior", semi_senior: "semi-senior", senior: "senior", expert: "lead" }
const MODALITY: Record<string, string> = { full_time: "Tiempo completo", part_time: "Medio tiempo", freelance: "Contrato", internship: "Prácticas", temporary: "Temporal" }

export function mapGetOnBoardJob(item: Item): ExternalJob | null {
  const a = item.attributes as Record<string, unknown>
  const title = typeof a.title === "string" ? a.title.trim() : ""
  const url = item.links?.public_url
  if (!title || !url) return null
  const companyRel = a.company as Rel
  const seniorityKey = (a.seniority as Rel)?.data?.attributes?.locale_key
  const modalityKey = (a.modality as Rel)?.data?.attributes?.locale_key
  const tags = ((a.tags as { data?: { attributes?: { name?: string } }[] } | undefined)?.data ?? []).map((t) => t.attributes?.name).filter((x): x is string => !!x)
  const countries = Array.isArray(a.countries) ? (a.countries as string[]) : []
  const html = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "")
  const head = (k: string, fallback: string) => (typeof a[k] === "string" && a[k] ? (a[k] as string) : fallback)
  const description = [
    `${head("description_headline", "Requisitos")}`,
    ...htmlToLines(html("description")),
    `${head("functions_headline", "Responsabilidades")}`,
    ...htmlToLines(html("functions")),
    ...(html("desirable") ? [head("desirable_headline", "Deseable"), ...htmlToLines(html("desirable"))] : []),
  ].join("\n")
  const published = typeof a.published_at === "number" ? new Date(a.published_at * 1000).toISOString() : undefined
  const remoteMode = typeof a.remote_modality === "string" ? a.remote_modality : undefined
  return {
    sourceKey: "getonboard",
    sourceName: "getonboard",
    externalId: String(item.id),
    url,
    title,
    company: companyRel?.data?.attributes?.name,
    countries,
    remote: remoteMode ? remoteMode === "fully_remote" || remoteMode === "remote_local" : undefined,
    workMode: remoteMode ? WORK_MODE[remoteMode] : undefined,
    employmentType: modalityKey ? MODALITY[modalityKey] : undefined,
    seniority: seniorityKey ? SENIORITY[seniorityKey] : undefined,
    department: typeof a.category_name === "string" ? a.category_name : undefined,
    postedAt: published,
    description,
    structured: {
      requirements: htmlListItems(html("description")).slice(0, 12),
      responsibilities: htmlListItems(html("functions")).slice(0, 12),
      niceToHave: htmlListItems(html("desirable")).slice(0, 12),
      skills: tags.slice(0, 12),
    },
    language: a.lang === "es" ? "es" : a.lang === "en" ? "en" : undefined,
    assumeRemoteLatam: true,
  }
}

export async function fetchGetOnBoard(opts: { fetchImpl?: typeof fetch; pauseMs?: number; signal?: AbortSignal } = {}): Promise<FetchResult> {
  const doFetch = withRetry(opts.fetchImpl ?? fetchWithCurlFallback())
  const jobs: ExternalJob[] = []
  let totalPages = 1
  let complete = false
  for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
    const res = await doFetch(`${BASE}?query=&per_page=100&page=${page}&${EXPAND}`, { headers: SOURCE_HEADERS, signal: opts.signal ?? AbortSignal.timeout(45_000) })
    if (!res.ok) throw new Error(`Get on Board respondió ${res.status}`)
    const d = (await res.json()) as { data?: Item[]; meta?: { total_pages?: number } }
    totalPages = d.meta?.total_pages ?? 1
    for (const it of d.data ?? []) {
      const j = mapGetOnBoardJob(it)
      if (j) jobs.push(j)
    }
    if (page >= totalPages) complete = true
    else await sleep(opts.pauseMs ?? 1200)
  }
  return { jobs, complete }
}
