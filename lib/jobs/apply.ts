/**
 * Cómo se postula a una oferta. Se deduce SIN IA de: el enlace que entrega la fuente (`applyUrl`), el sitio de la oferta
 * y frases del texto («envía tu CV a…»). Si no se puede saber, se dice «Ver la oferta original» en vez de adivinar.
 *  - plataforma: se postula dentro de un portal (LinkedIn, Indeed, Computrabajo…); suele pedir cuenta.
 *  - formulario: formulario de la propia empresa, alojado en su sistema de selección (Greenhouse, Lever, Ashby…).
 *  - correo: se envía el CV a un correo.
 *  - sitio: página de la empresa.
 */
export const APPLY_METHODS = ["plataforma", "formulario", "correo", "sitio", "desconocido"] as const
export type ApplyMethod = (typeof APPLY_METHODS)[number]
export type Apply = { method: ApplyMethod; platform?: string; url?: string; email?: string }

const PLATFORMS: [RegExp, string][] = [
  [/(^|\.)linkedin\.com$/, "LinkedIn"],
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

const EMAIL_APPLY = /(?:env[ií]a(?:r|nos)?|mand(?:a|ar)|remite|postula(?:te)?|aplica(?:r)?|escr[ií]be(?:nos)?|send (?:us )?(?:your )?(?:cv|resume|application)|apply (?:by|via|at|to))[^.\n@]{0,70}?([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i

function fromUrl(url: string): Apply | null {
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
export function detectApply(input: { sourceUrl: string; text?: string; applyUrl?: string }): Apply {
  const explicit = input.applyUrl
  if (explicit) {
    const a = fromUrl(explicit)
    if (a) return a
  }
  const email = input.text?.match(EMAIL_APPLY)?.[1]
  const fromSource = input.sourceUrl.startsWith("http") ? fromUrl(input.sourceUrl) : null
  if (email && (!fromSource || fromSource.method === "sitio")) return { method: "correo", email, url: `mailto:${email}` }
  if (fromSource) return fromSource
  if (email) return { method: "correo", email, url: `mailto:${email}` }
  return { method: "desconocido" }
}

/** Frase corta para la tarjeta: lo que la persona debe esperar al postular. */
export function applyLabel(a?: Apply | null): string {
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
export function applyCta(a?: Apply | null): string {
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
export function applyHint(a?: Apply | null): string {
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
