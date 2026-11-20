import { lookup as dnsLookup } from "node:dns/promises"
import { isIP } from "node:net"
import { extractOffer, type ExtractMethod } from "./extract"
import type { JobLd } from "./html"
import { OFFER_MAX_CHARS } from "@/lib/schemas/offer"

export type OfferErrorCode = "invalid_url" | "blocked_host" | "login_required" | "unreachable" | "not_html" | "empty" | "too_large"

export class OfferError extends Error {
  constructor(
    public code: OfferErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "OfferError"
  }
}

const MAX_BYTES = 2 * 1024 * 1024
const TIMEOUT_MS = 15_000
const PASTE_HINT = "Copia el texto de la oferta y pégalo en la pestaña «Pegar texto»."

export function parseOfferUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new OfferError("invalid_url", "Esa dirección no es válida. Debe empezar por http:// o https://.")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new OfferError("invalid_url", "Solo se admiten enlaces http:// o https://.")
  }
  return url
}

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase()
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7))
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")
  }
  const [a, b] = ip.split(".").map(Number)
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
}

type Lookup = (host: string) => Promise<string[]>
const defaultLookup: Lookup = async (host) => (await dnsLookup(host, { all: true })).map((r) => r.address)

async function assertPublic(url: URL, lookup: Lookup) {
  const host = url.hostname.replace(/^\[|\]$/g, "")
  let addrs: string[]
  try {
    addrs = isIP(host) ? [host] : await lookup(host)
  } catch {
    throw new OfferError("unreachable", `No se pudo encontrar el sitio «${host}». Revisa el enlace. ${PASTE_HINT}`)
  }
  if (addrs.some(isPrivateAddress)) {
    throw new OfferError("blocked_host", "Por seguridad no se descargan direcciones de la red local.")
  }
}

const LOGIN_PATH = /\/(login|signin|sign-in|authwall|uas\/login|checkpoint)\b/i
const LOGIN_TEXT = /(inicia(r)? sesi[oó]n|sign in|log in|join to view|reg[ií]strate para)/i

export function looksLikeLoginWall(finalUrl: string, text: string): boolean {
  return LOGIN_PATH.test(new URL(finalUrl).pathname) || (text.length < 600 && LOGIN_TEXT.test(text))
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return await res.text()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > MAX_BYTES) {
      await reader.cancel()
      throw new OfferError("too_large", "La página es demasiado grande para leerla.")
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

export type FetchedOffer = { text: string; method: ExtractMethod | "texto"; site?: string; title?: string; company?: string; ld?: JobLd; /** dirección final tras las redirecciones */ finalUrl?: string }

/** Descarga la página de una oferta y devuelve su contenido principal (capa 1: extracción determinista). */
export async function fetchOffer(
  rawUrl: string,
  opts: { fetchImpl?: typeof fetch; lookup?: Lookup; signal?: AbortSignal } = {},
): Promise<FetchedOffer> {
  const doFetch = opts.fetchImpl ?? fetch
  const lookup = opts.lookup ?? defaultLookup
  let url = parseOfferUrl(rawUrl)
  let res: Response | undefined

  // Redirecciones manuales para volver a comprobar que cada destino es público.
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url, lookup)
    const timeout = AbortSignal.timeout(TIMEOUT_MS)
    try {
      res = await doFetch(url, {
        redirect: "manual",
        signal: opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CVTailor/0.1)", Accept: "text/html,text/plain;q=0.9" },
      })
    } catch {
      throw new OfferError("unreachable", `No se pudo abrir el enlace. ${PASTE_HINT}`)
    }
    const loc = res.headers.get("location")
    if (res.status >= 300 && res.status < 400 && loc) {
      url = parseOfferUrl(new URL(loc, url).toString())
      continue
    }
    break
  }
  if (!res || (res.status >= 300 && res.status < 400)) {
    throw new OfferError("unreachable", `El enlace redirige demasiadas veces. ${PASTE_HINT}`)
  }

  if ([401, 403, 999].includes(res.status)) {
    throw new OfferError("login_required", `Ese sitio no deja leer la oferta sin iniciar sesión. ${PASTE_HINT}`)
  }
  if (!res.ok) {
    throw new OfferError("unreachable", `El sitio respondió con error ${res.status}. ${PASTE_HINT}`)
  }
  const type = res.headers.get("content-type") ?? ""
  if (type && !/text\/(html|plain)|application\/xhtml/i.test(type)) {
    throw new OfferError("not_html", `El enlace no es una página web de texto. ${PASTE_HINT}`)
  }

  const body = await readCapped(res)
  const isHtml = /html/i.test(type) || /<html|<body/i.test(body)
  const extracted = isHtml ? extractOffer(body, url.toString()) : { text: body.trim(), method: "texto" as const }
  const text = extracted?.text ?? ""
  if (looksLikeLoginWall(url.toString(), text)) {
    throw new OfferError("login_required", `Ese sitio pide iniciar sesión para ver la oferta. ${PASTE_HINT}`)
  }
  if (!text) {
    throw new OfferError("empty", `La página no tiene texto legible (puede cargarse con JavaScript). ${PASTE_HINT}`)
  }
  return { ...extracted!, text: text.slice(0, OFFER_MAX_CHARS), finalUrl: url.toString() }
}

/** Igual que `fetchOffer`, pero solo el texto. */
export async function fetchOfferText(rawUrl: string, opts: Parameters<typeof fetchOffer>[1] = {}): Promise<string> {
  return (await fetchOffer(rawUrl, opts)).text
}
