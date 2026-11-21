import { assertPublic, defaultLookup, parseOfferUrl, type Lookup } from "./fetch-url"

/**
 * Enlaces cortos de LinkedIn (`lnkd.in`): el del propio post (`lnkd.in/p/…`) redirige a la publicación y los del texto (`lnkd.in/AbC123`) muestran una página
 * intermedia con el destino real (un formulario de Google, la página de la empresa…). Se siguen solo estos enlaces, con las mismas protecciones que al
 * leer una oferta (solo direcciones públicas, redirecciones comprobadas una a una, tiempo y tamaño limitados).
 */
const SHORT_HOST = /(^|\.)lnkd\.in$/i
const MAX_HOPS = 3
const TIMEOUT_MS = 6000

export const isShortLink = (url: string): boolean => {
  try {
    return SHORT_HOST.test(new URL(url).hostname)
  } catch {
    return false
  }
}

/** Primer enlace externo (que no sea de LinkedIn) de la página intermedia. */
export function externalLinkIn(html: string): string | undefined {
  for (const m of html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) {
    const href = m[1].replace(/&amp;/g, "&")
    try {
      const h = new URL(href).hostname
      if (!/(^|\.)(linkedin\.com|licdn\.com|lnkd\.in)$/i.test(h)) return href
    } catch {
      /* enlace inválido */
    }
  }
  return undefined
}

/** Destino real de un enlace corto de LinkedIn; `undefined` si no es uno, no se pudo resolver o el destino no es público. */
export async function resolveShortLink(raw: string, opts: { fetchImpl?: typeof fetch; lookup?: Lookup } = {}): Promise<string | undefined> {
  if (!isShortLink(raw)) return undefined
  const doFetch = opts.fetchImpl ?? fetch
  const lookup = opts.lookup ?? defaultLookup
  try {
    let url = parseOfferUrl(raw)
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      await assertPublic(url, lookup)
      const res = await doFetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "Mozilla/5.0 (compatible; CVTailor/0.1)", Accept: "text/html" } })
      const loc = res.headers.get("location")
      if (res.status >= 300 && res.status < 400 && loc) {
        const next = parseOfferUrl(new URL(loc, url).toString())
        if (!isShortLink(next.toString())) return next.toString() // ya salió de LinkedIn-corto: ese es el destino
        url = next
        continue
      }
      if (!res.ok) return undefined
      const html = (await res.text()).slice(0, 200_000)
      const dest = externalLinkIn(html)
      if (!dest) return undefined
      await assertPublic(parseOfferUrl(dest), lookup) // el destino también tiene que ser público
      return dest
    }
  } catch {
    return undefined
  }
  return undefined
}
