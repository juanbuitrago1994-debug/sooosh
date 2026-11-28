import type { WorkMode } from "@/lib/jobs/draft"
import type { Salary } from "@/lib/jobs/salary"

/**
 * Una oferta tal como la entrega una fuente, ya con campos comunes. Cada adaptador (Get on Board, Greenhouse, Lever, Ashby…) traduce
 * su formato a esto; `normalize.ts` la convierte en una tarjeta. Nada de aquí se inventa: lo que la fuente no dice queda vacío.
 */
export type ExternalJob = {
  /** `getonboard`, `greenhouse:cabify`… (clave de la fuente; sirve para cerrar lo que desaparece) */
  sourceKey: string
  /** nombre corto de la plataforma (`getonboard`, `greenhouse`…) */
  sourceName: string
  externalId: string
  /** enlace público de la oferta */
  url: string
  /** enlace de postulación, si la fuente lo da aparte */
  applyUrl?: string
  title: string
  company?: string
  locationText?: string
  /** países o lugares tal como los nombra la fuente («Chile», «Remote», «CO») */
  countries?: string[]
  remote?: boolean
  workMode?: WorkMode
  employmentType?: string
  seniority?: string
  /** área o equipo que declara la fuente («Engineering», «Programming»…): ayuda a clasificar el cargo */
  department?: string
  salary?: Salary
  postedAt?: string
  /** hasta cuándo está vigente, si la fuente lo dice (JSON-LD `validThrough`) */
  validThrough?: string
  /** texto completo de la oferta, plano, con las listas como «• elemento» (ver `htmlToLines`) */
  description: string
  /** secciones que la fuente ya separa (si no, se deducen del texto) */
  structured?: { requirements?: string[]; responsibilities?: string[]; niceToHave?: string[]; skills?: string[] }
  language?: "es" | "en" | "otro"
  /** para fuentes de alcance latinoamericano (Get on Board): «remoto» se toma como abierto a Latinoamérica */
  assumeRemoteLatam?: boolean
}

export type FetchResult = {
  /** avisos del lector (p. ej. «se detuvo: el sitio respondió 403») */
  notes?: string[]
  jobs: ExternalJob[]
  /** true si se leyó TODO lo que la fuente tiene: solo entonces se cierra lo que ya no aparece */
  complete: boolean
}

export type SyncReport = {
  source: string
  fetched: number
  /** descartadas por no ser de Latinoamérica ni remotas para la región */
  outOfRegion: number
  /** descartadas por ser la misma oferta que ya llegó de otra fuente */
  duplicates: number
  created: number
  updated: number
  closed: number
  /** ofertas pobres puestas en la cola de enriquecimiento con IA */
  queued?: number
  error?: string
  ms: number
}

/** Cabeceras de todas las lecturas a fuentes: identifican a Sooosh y no fingen ser un navegador. */
export const SOURCE_HEADERS = { "User-Agent": "SoooshBot/0.1 (buscador de ofertas; lectura de APIs publicas)", Accept: "application/json" }

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Lectura cortés: si la fuente responde «no ahora» (403 de su cortafuegos, 429 o 5xx) se espera y se reintenta hasta 2 veces, respetando
 * `Retry-After` (máx. 60 s). Misma identificación SoooshBot siempre: es paciencia, no una forma de rodear un bloqueo. 404 y el resto no se reintentan.
 */
import { execFile } from "node:child_process"

/**
 * Get on Board (Cloudflare) responde 403 al cliente HTTP de Node desde IPs de centros de datos (GitHub Actions) y 200 a `curl` con las
 * MISMAS cabeceras y la MISMA identificación SoooshBot (comprobado el 20-nov-2026). Juan autorizó (20-nov-2026) usar `curl` para esa API
 * pública y documentada: se reintenta una sola vez con `curl`, sin cambiar quiénes somos ni el ritmo de lectura. Si también falla, se respeta el 403.
 */
export function fetchWithCurlFallback(f: typeof fetch = fetch): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const res = await f(input, init)
    if (res.status !== 403 || process.env.VITEST || process.env.SYNC_CURL_FALLBACK === "0") return res
    const headers = new Headers(init?.headers)
    const args = ["-sS", "--max-time", "45", "-w", "\n__STATUS__%{http_code}"]
    headers.forEach((v, k) => args.push("-H", `${k}: ${v}`))
    args.push(String(input))
    const out = await new Promise<string | null>((resolve) => execFile("curl", args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => resolve(err ? null : stdout)))
    const m = out?.match(/^([\s\S]*)\n__STATUS__(\d{3})$/)
    return m ? new Response(m[2] === "204" ? null : m[1], { status: Number(m[2]) }) : res
  }) as typeof fetch
}

const RETRY_WAITS = process.env.VITEST ? [] : [10_000, 30_000]
export function withRetry(f: typeof fetch, waits: number[] = RETRY_WAITS): typeof fetch {
  return (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    let res = await f(input, init)
    for (const wait of waits) {
      if (!(res.status === 403 || res.status === 429 || res.status >= 500)) break
      const ra = Number(res.headers?.get?.("retry-after"))
      await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 60_000) : wait)
      res = await f(input, init)
    }
    return res
  }) as typeof fetch
}
