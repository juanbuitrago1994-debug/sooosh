/**
 * Cómo se postula a una oferta. Se deduce SIN IA de: el enlace que entrega la fuente (`applyUrl`), el sitio de la oferta
 * y frases del texto («envía tu CV a…»). Si no se puede saber, se dice «Ver la oferta original» en vez de adivinar.
 *  - plataforma: se postula dentro de un portal (LinkedIn, Indeed, Computrabajo…); suele pedir cuenta.
 *  - formulario: formulario de la propia empresa, alojado en su sistema de selección (Greenhouse, Lever, Ashby…).
 *  - correo: se envía el CV a un correo.
 *  - sitio: página de la empresa.
 */
import { detectEmails, MAX_EMAILS } from "@/lib/jobs/emails"

export const APPLY_METHODS = ["plataforma", "formulario", "correo", "sitio", "desconocido"] as const
export type ApplyMethod = (typeof APPLY_METHODS)[number]
/** Una vía de postulación. */
export type ApplyChannel = { method: ApplyMethod; platform?: string; url?: string; email?: string }
/** La vía principal más, si la oferta las trae, otras vías (p. ej. correo Y formulario). */
export type Apply = ApplyChannel & {
  alt?: ApplyChannel[]
  /** Todos los correos de postulación detectados en el texto (máx. 3, el más probable primero); alimenta el panel de correo. */
  emails?: string[]
}

const PLATFORMS: [RegExp, string][] = [
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
  [/(^|\.)lnkd\.in$/, "LinkedIn"],
  [/(^|\.)indeed\./, "Indeed"],
  [/computrabajo\./, "Computrabajo"],
  [/(^|\.)getonbrd\.com$/, "Get on Board"],
  [/(^|\.)elempleo\.com$/, "elempleo"],
  [/(^|\.)magneto365\.com$/, "Magneto"],
  [/(^|\.)bumeran\./, "Bumeran"],
  [/(^|\.)zonajobs\./, "Zonajobs"],
  [/(^|\.)laborum\./, "Laborum"],
  [/(^|\.)trabajando\./, "Trabajando.cl"],
  [/(^|\.)chiletrabajos\.cl$/, "Chiletrabajos"],
  [/(^|\.)torre\.(co|ai)$/, "Torre"],
  [/(^|\.)workana\.com$/, "Workana"],
]
/** Sistemas de selección: el enlace lleva al formulario de la empresa. */
const ATS = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|recruitee\.com|smartrecruiters\.com|personio\.(de|com)|breezy\.hr|teamtailor\.com|bamboohr\.com|workday\.com|myworkdayjobs\.com|jobvite\.com|icims\.com|applytojob\.com)$/

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase()
  } catch {
    return ""
  }
}


/** Enlaces a formularios que aparecen en el texto de la oferta (Google Forms, Microsoft Forms, Typeform, Tally… o un sistema de selección). */
const FORM_HOSTS = /(^|\.)(forms\.gle|forms\.office\.com|forms\.microsoft\.com|typeform\.com|tally\.so|jotform\.com|forms\.zohopublic\.com|surveymonkey\.com)$/
export function isFormUrl(url: string): boolean {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, "").toLowerCase()
    return (host === "docs.google.com" && u.pathname.startsWith("/forms")) || FORM_HOSTS.test(host) || ATS.test(host)
  } catch {
    return false
  }
}
const linksIn = (text?: string): string[] => text?.match(/https?:\/\/[^\s<>"')\]]+/gi)?.map((u) => u.replace(/[.,;:!?]+$/, "")) ?? []
const isShort = (u: string) => hostOf(u) === "lnkd.in"

/**
 * Otra vía de postulación que traen los enlaces del texto: un formulario (Google Forms, Typeform, un sistema de selección…) o, si un enlace corto de
 * LinkedIn se pudo resolver (`resolved`: corto → destino real), la página a la que lleva. Un enlace corto sin resolver no cuenta.
 */
function linkChannelIn(text: string | undefined, resolved: Record<string, string> = {}): ApplyChannel | undefined {
  const urls = linksIn(text).map((u) => resolved[u] ?? u).filter((u) => !isShort(u))
  const form = urls.find(isFormUrl)
  if (form) return { method: "formulario", url: form }
  const viaShort = linksIn(text).find((u) => resolved[u] && !isShort(resolved[u]))
  if (!viaShort) return undefined
  const ch = fromUrl(resolved[viaShort])
  return ch && ch.method !== "plataforma" ? ch : undefined
}

function fromUrl(url: string): ApplyChannel | null {
  const host = hostOf(url)
  if (!host) return null
  const platform = PLATFORMS.find(([re]) => re.test(host))?.[1]
  if (platform) return { method: "plataforma", platform, url }
  if (ATS.test(host)) return { method: "formulario", url }
  return { method: "sitio", url }
}

/**
 * `applyUrl` = enlace de postulación que entrega la fuente (API o JSON-LD) y manda sobre todo; si no hay, se usa el enlace de la
 * oferta (`sourceUrl`). Un correo con verbo de postulación en el texto gana sobre un enlace genérico de portal.
 */
export function detectApply(input: { sourceUrl: string; text?: string; applyUrl?: string; /** enlaces cortos de LinkedIn del texto ya resueltos (corto → destino real) */ resolved?: Record<string, string> }): Apply {
  const main = mainChannel(input)
  const found = detectEmails(input.text)
  const email = found[0]?.email
  const extra = linkChannelIn(input.text, input.resolved)
  // Sin otra pista, el formulario (o la página) enlazado en el texto es la vía.
  const primary: ApplyChannel = main.method === "desconocido" && extra ? extra : main
  const alt: ApplyChannel[] = []
  if (email && primary.method !== "correo") alt.push({ method: "correo", email, url: `mailto:${email}` })
  if (extra && extra.url !== primary.url) alt.push(extra)
  const emails = [...new Set([...(primary.email ? [primary.email] : []), ...found.map((e) => e.email)])].slice(0, MAX_EMAILS)
  return { ...primary, ...(alt.length ? { alt } : {}), ...(emails.length ? { emails } : {}) }
}

/** Correos de postulación de una oferta: los detectados, o (datos guardados antes de `emails`) los de sus vías. */
export function emailsOf(a?: Apply | null): string[] {
  if (!a) return []
  if (a.emails?.length) return a.emails
  return applyChannels(a).flatMap((c) => (c.email ? [c.email] : []))
}

/** Todas las vías de postulación (la principal primero) que se pueden usar: tienen enlace o correo. */
export function applyChannels(a?: Apply | null): ApplyChannel[] {
  if (!a) return []
  const { alt, ...main } = a
  return [main, ...(alt ?? [])].filter((c) => c.method !== "desconocido" && (c.url || c.email))
}

/** Enlace de una vía: el suyo, o `mailto:` si solo tiene correo. */
export const channelHref = (c: ApplyChannel): string | undefined => c.url ?? (c.email ? `mailto:${c.email}` : undefined)

function mainChannel(input: { sourceUrl: string; text?: string; applyUrl?: string }): ApplyChannel {
  const explicit = input.applyUrl
  if (explicit) {
    const a = fromUrl(explicit)
    if (a) return a
  }
  // Solo un correo «fuerte» (con verbo de postulación) manda sobre el enlace de la oferta; uno suelto queda como alternativa.
  const email = detectEmails(input.text).find((e) => e.strong)?.email
  const fromSource = input.sourceUrl.startsWith("http") ? fromUrl(input.sourceUrl) : null
  if (email && (!fromSource || fromSource.method === "sitio")) return { method: "correo", email, url: `mailto:${email}` }
  if (fromSource) return fromSource
  if (email) return { method: "correo", email, url: `mailto:${email}` }
  return { method: "desconocido" }
}

/** Frase corta para la tarjeta: lo que la persona debe esperar al postular. */
export function applyLabel(a?: ApplyChannel | null): string {
  switch (a?.method) {
    case "plataforma":
      return `Se aplica en ${a.platform ?? "otro portal"}`
    case "formulario":
      return "Formulario de la empresa"
    case "correo":
      return "Se aplica por correo"
    case "sitio":
      return "En el sitio de la empresa"
    default:
      return "Ver la oferta original"
  }
}

/** Texto del botón principal del detalle. */
export function applyCta(a?: ApplyChannel | null): string {
  switch (a?.method) {
    case "plataforma":
      return `Postular en ${a.platform ?? "el portal"}`
    case "formulario":
      return "Ir al formulario"
    case "correo":
      return "Enviar mi CV por correo"
    case "sitio":
      return "Postular en el sitio"
    default:
      return "Ver la oferta original"
  }
}

/** Una línea que explica qué pasa al pulsar, sin prometer lo que no sabemos. */
export function applyHint(a?: ApplyChannel | null): string {
  switch (a?.method) {
    case "plataforma":
      return `Se abre ${a.platform ?? "el portal"} en otra pestaña; puede pedirte iniciar sesión.`
    case "formulario":
      return "Se abre el formulario de la empresa en otra pestaña."
    case "correo":
      return a.email ? `Escribe a ${a.email} con tu CV adjunto.` : "Envía tu CV al correo de la oferta."
    case "sitio":
      return "Se abre la página de la empresa en otra pestaña."
    default:
      return "No pudimos saber cómo se postula: abre la oferta original para verlo."
  }
}
