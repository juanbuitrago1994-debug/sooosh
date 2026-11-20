import { classifyRole } from "@/lib/jobs/classify"
import type { WorkMode } from "@/lib/jobs/draft"
import { detectEmploymentType } from "@/lib/jobs/draft"
import { normalizeSourceUrl } from "@/lib/jobs/url"
import { jobPostingFromJsonLd } from "@/lib/offer/html"
import { htmlToLines } from "../text"
import { SOURCE_HEADERS, sleep, type ExternalJob, type FetchResult } from "../types"
import { isAllowed, loadRobots, type Robots } from "./robots"
import { parseSitemap } from "./sitemap"

/**
 * Portales de empleo SIN API pública (Fase L4, decisión de Juan del 19-nov-2026; él asume la responsabilidad de usarlos).
 * Reglas que este lector cumple SIEMPRE:
 *  1. Lee el robots.txt y no entra a lo que prohíbe; si el sitio ni siquiera deja leer su robots.txt (403…), no entra.
 *  2. Se identifica como SoooshBot; no finge ser un navegador.
 *  3. Solo páginas públicas (las del sitemap que el propio sitio publica), una por vez y con pausa.
 *  4. Si el sitio responde 401, 403, 429 o 5xx, se DETIENE (no reintenta ni rodea el bloqueo).
 *  5. Solo lee los datos estructurados que la página publica para buscadores (JSON-LD `JobPosting`); no extrae nada más.
 *  6. Cada oferta enlaza al original (el botón «Postular» lleva al sitio del portal).
 */
export type PortalConfig = {
  key: string
  name: string
  origin: string
  /** sitemaps de las ofertas (si el robots.txt lista otros, se ignoran: aquí se elige cuáles) */
  sitemaps: string[]
  /** índice de sitemaps: solo se siguen los hijos cuyo nombre cumpla esto */
  childFilter?: RegExp
  /** la dirección es de una oferta (y no de otra cosa) */
  jobUrl: RegExp
  /** el cargo, sacado de la dirección (los portales ponen el título en el enlace): sirve para elegir cuáles leer sin descargarlas todas */
  titleFromUrl: (url: string) => string
}

export const CHILETRABAJOS: PortalConfig = {
  key: "chiletrabajos",
  name: "Chiletrabajos",
  origin: "https://www.chiletrabajos.cl",
  sitemaps: ["https://www.chiletrabajos.cl/sitemap.xml"],
  jobUrl: /\/trabajo\/[^/]+-\d+$/,
  titleFromUrl: (u) => decodeURIComponent(u.split("/").pop() ?? "").replace(/-\d+$/, "").replace(/-/g, " "),
}

export const TRABAJANDO: PortalConfig = {
  key: "trabajando",
  name: "Trabajando.cl",
  origin: "https://www.trabajando.cl",
  sitemaps: ["https://www.trabajando.cl/sitemap.xml"],
  childFilter: /sitemap-ofertas/i,
  jobUrl: /\/trabajo\/\d+-[^/]+$/,
  titleFromUrl: (u) => decodeURIComponent(u.split("/").pop() ?? "").replace(/^\d+-/, "").replace(/-/g, " "),
}

export const PORTALS: PortalConfig[] = [CHILETRABAJOS, TRABAJANDO]

const BLOCK = new Set([401, 403, 429, 500, 502, 503, 504])
const WORK: Record<string, WorkMode> = { TELECOMMUTE: "remoto" }

export type PortalOptions = {
  /** direcciones ya guardadas (se leen primero las nuevas) */
  known?: Set<string>
  /** máximo de páginas a descargar por corrida */
  maxPages?: number
  /** solo cargos de tecnología según el título de la dirección (la mayoría de los avisos no lo son) */
  onlyTech?: boolean
  pauseMs?: number
  fetchImpl?: typeof fetch
}

const norm = (u: string) => {
  try {
    return normalizeSourceUrl(u).url
  } catch {
    return u
  }
}

async function getText(url: string, f: typeof fetch, accept: string): Promise<{ status: number; text: string }> {
  const res = await f(url, { headers: { ...SOURCE_HEADERS, Accept: accept }, signal: AbortSignal.timeout(30_000) })
  return { status: res.status, text: res.ok ? await res.text() : "" }
}

/** De la página de una oferta (su JSON-LD) a una oferta común. null si la página no publica una oferta legible. */
export function jobFromPage(cfg: PortalConfig, url: string, html: string): ExternalJob | null {
  const jp = jobPostingFromJsonLd(html)
  if (!jp?.title) return null
  const ld = jp.ld
  const lines = htmlToLines(jp.description)
  return {
    sourceKey: `portal:${cfg.key}`,
    sourceName: cfg.key,
    externalId: url.split("/").pop() ?? url,
    url,
    title: jp.title.trim(),
    company: jp.company,
    locationText: ld.location,
    countries: ld.location ? [ld.location.split(",").at(-1)!.trim()] : undefined,
    workMode: ld.remote ? WORK.TELECOMMUTE : undefined,
    remote: ld.remote,
    employmentType: detectEmploymentType("", ld),
    postedAt: ld.datePosted,
    validThrough: ld.validThrough,
    salary: ld.salary && ["COP", "CLP", "ARS", "MXN", "PEN", "UYU", "BRL", "USD", "EUR"].includes(ld.salary.currency) ? (ld.salary as ExternalJob["salary"]) : undefined,
    description: lines.join("\n"),
  }
}

export async function fetchPortal(cfg: PortalConfig, opts: PortalOptions = {}): Promise<FetchResult> {
  const f = opts.fetchImpl ?? fetch
  const notes: string[] = []
  const robots: Robots = await loadRobots(cfg.origin, f)
  if (robots.blocked) return { jobs: [], complete: false, notes: [robots.reason ?? `${cfg.name} no permite lectura automática`] }

  // 1) direcciones de las ofertas, desde los sitemaps que el sitio publica
  const urls: { loc: string; lastmod?: string }[] = []
  for (const sm of cfg.sitemaps) {
    if (!isAllowed(robots, new URL(sm).pathname)) {
      notes.push(`El robots.txt no permite leer ${sm}`)
      continue
    }
    const r = await getText(sm, f, "application/xml,text/xml")
    if (BLOCK.has(r.status)) return { jobs: [], complete: false, notes: [...notes, `${cfg.name} respondió ${r.status} al pedir su sitemap: se detuvo`] }
    const parsed = parseSitemap(r.text)
    if (!parsed.index) urls.push(...parsed.entries)
    else
      for (const child of parsed.entries.filter((e) => !cfg.childFilter || cfg.childFilter.test(e.loc))) {
        await sleep(opts.pauseMs ?? 1200)
        const c = await getText(child.loc, f, "application/xml,text/xml")
        if (BLOCK.has(c.status)) return { jobs: [], complete: false, notes: [...notes, `${cfg.name} respondió ${c.status} al pedir un sitemap: se detuvo`] }
        urls.push(...parseSitemap(c.text).entries)
      }
  }

  // 2) cuáles leer: ofertas nuevas, de tecnología si se pidió, las más recientes primero
  const candidates = urls
    .filter((u) => cfg.jobUrl.test(u.loc))
    .filter((u) => !opts.known?.has(norm(u.loc)))
    .filter((u) => isAllowed(robots, new URL(u.loc).pathname + new URL(u.loc).search))
    .filter((u) => !opts.onlyTech || classifyRole({ title: cfg.titleFromUrl(u.loc) }).tech)
    .sort((a, b) => (b.lastmod ?? "").localeCompare(a.lastmod ?? ""))
    .slice(0, opts.maxPages ?? 100)
  notes.push(`${urls.length} avisos en el sitemap; ${candidates.length} candidatos nuevos${opts.onlyTech ? " de tecnología" : ""}`)

  // 3) una página por vez, con pausa; ante un bloqueo, se detiene
  const jobs: ExternalJob[] = []
  for (const c of candidates) {
    await sleep(opts.pauseMs ?? 1200)
    const r = await getText(c.loc, f, "text/html")
    if (BLOCK.has(r.status)) {
      notes.push(`${cfg.name} respondió ${r.status}: se detuvo (no se reintenta)`)
      break
    }
    const j = r.text ? jobFromPage(cfg, c.loc, r.text) : null
    if (j) jobs.push(j)
  }
  // Un sitemap de decenas de miles de avisos no se lee completo en una corrida: no se cierra nada por «no aparecer».
  return { jobs, complete: false, notes }
}
