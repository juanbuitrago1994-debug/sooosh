import { assertPublic, defaultLookup, looksLikeLoginWall, parseOfferUrl, type Lookup } from "@/lib/offer/fetch-url"
import { htmlToText, jobPostingFromJsonLd } from "@/lib/offer/html"

/**
 * ¿Sigue abierta la oferta de este enlace? Tres respuestas honestas: `alive`, `dead` (hay una señal clara de que cerró) o `unknown`
 * (el sitio no deja ver, falló la red o la página no se puede leer: NO cuenta como cerrada ni como abierta).
 */
export type Verdict = { state: "alive" | "dead" | "unknown"; reason: string; /** la propia página declara que venció: no hace falta confirmarlo dos veces */ declared?: boolean }

/** Frases con las que los sitios avisan que una oferta ya no está abierta (se buscan solo al comienzo de la página). */
const CLOSED_TEXT =
  /(ya no (est[aá]|se encuentra) disponible|ya no est[aá] activ[ao]|(oferta|vacante|posici[oó]n|empleo) (ya )?(est[aá] |se ha |ha sido |ha |fue )?(cerrad[ao]|finalizad[ao]|expirad[ao]|caducad[ao]|no disponible)|ya no (se )?acepta(n)? (postulaciones|aplicaciones|candidaturas|candidatos)|proceso de (selecci[oó]n|postulaci[oó]n) (ha )?(finalizado|cerrado)|no longer (available|accepting applications|open)|(position|role|job|vacancy) (has been|is|was) (filled|closed|removed)|(this )?(job|posting|listing|position) (has )?(expired|been (removed|closed))|applications? (are |have )?(now )?closed|sorry, (this|the) job)/i

const HEAD_CHARS = 4000
const MIN_READABLE = 200

export function judgeResponse(p: { status: number; finalUrl: string; originalUrl: string; html: string; now?: Date }): Verdict {
  const now = p.now ?? new Date()
  if (p.status === 404 || p.status === 410) return { state: "dead", reason: `El sitio responde que la página ya no existe (${p.status}).` }
  if ([401, 403, 429, 999].includes(p.status) || p.status >= 500) return { state: "unknown", reason: `El sitio no dejó revisar la oferta (respondió ${p.status}).` }
  if (p.status < 200 || p.status >= 300) return { state: "unknown", reason: `Respuesta inesperada del sitio (${p.status}).` }

  const text = htmlToText(p.html)
  if (looksLikeLoginWall(p.finalUrl, text)) return { state: "unknown", reason: "El sitio pide iniciar sesión para ver la oferta; no se puede revisar sola." }

  // Cuando una oferta cierra, muchos sitios redirigen: a la portada, a la lista de ofertas de la empresa (Lever, Ashby…) o a una página con `?error=true` (Greenhouse).
  try {
    const was = new URL(p.originalUrl)
    const end = new URL(p.finalUrl)
    const trim = (x: string) => x.replace(/\/+$/, "")
    const a = trim(was.pathname)
    const b = trim(end.pathname)
    if (a.length > 1 && b === "") return { state: "dead", reason: "El enlace ahora lleva a la portada del sitio." }
    if (end.searchParams.has("error") && !was.searchParams.has("error")) return { state: "dead", reason: "El sitio redirige a una página de error: la oferta ya no existe." }
    if (b.length > 1 && b !== a && a.startsWith(`${b}/`)) return { state: "dead", reason: "El enlace ahora lleva a la lista general de ofertas." }
  } catch {
    /* enlaces ya validados al guardarse */
  }

  const ld = jobPostingFromJsonLd(p.html)?.ld
  if (ld?.validThrough) {
    const until = new Date(ld.validThrough)
    if (!Number.isNaN(until.getTime()) && until.getTime() < now.getTime()) return { state: "dead", declared: true, reason: "La propia oferta declara que su vigencia terminó." }
  }
  const head = text.slice(0, HEAD_CHARS)
  const m = head.match(CLOSED_TEXT)
  if (m) return { state: "dead", reason: `La página dice que la oferta cerró («${m[0].slice(0, 60)}»).` }
  if (text.length < MIN_READABLE) return { state: "unknown", reason: "La página no se puede leer sin JavaScript; no se pudo revisar." }
  return { state: "alive", reason: "La oferta sigue publicada." }
}

const MAX_BYTES = 1_500_000
const TIMEOUT_MS = 15_000

/** Abre el enlace (solo direcciones públicas, redirecciones comprobadas una a una) y juzga la respuesta. Nunca lanza: un fallo es `unknown`. */
export async function probeOfferLink(rawUrl: string, opts: { fetchImpl?: typeof fetch; lookup?: Lookup; now?: Date } = {}): Promise<Verdict> {
  const doFetch = opts.fetchImpl ?? fetch
  const lookup = opts.lookup ?? defaultLookup
  try {
    let url = parseOfferUrl(rawUrl)
    let res: Response | undefined
    for (let hop = 0; hop < 5; hop++) {
      await assertPublic(url, lookup)
      res = await doFetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "Mozilla/5.0 (compatible; CVTailor/0.1)", Accept: "text/html,text/plain;q=0.9" } })
      const loc = res.headers.get("location")
      if (res.status >= 300 && res.status < 400 && loc) {
        url = parseOfferUrl(new URL(loc, url).toString())
        continue
      }
      break
    }
    if (!res || (res.status >= 300 && res.status < 400)) return { state: "unknown", reason: "El enlace redirige demasiadas veces." }
    let html = ""
    if (res.ok) {
      const buf = new Uint8Array(await res.arrayBuffer())
      html = new TextDecoder().decode(buf.length > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf)
    }
    return judgeResponse({ status: res.status, finalUrl: url.toString(), originalUrl: rawUrl, html, now: opts.now })
  } catch (e) {
    return { state: "unknown", reason: `No se pudo abrir el enlace (${(e as Error).message.slice(0, 80)}).` }
  }
}
