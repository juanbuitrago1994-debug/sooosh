import type { CV } from "@/lib/schemas/cv"
import { fillSubject } from "@/lib/jobs/subject"
import type { BodySettings, Lang } from "@/lib/apply/body-settings"

/**
 * Texto base del correo de postulación (plantilla pura, sin IA). Regla de oro: **nada se inventa**. Cada dato del correo sale del CV
 * de la persona o de la oferta; si falta, esa línea se omite (nunca queda un `{campo}` a la vista). Siempre de «tú».
 */
export type EmailJob = { title: string; company?: string | null; /** de dónde viene la oferta (`linkedin`, `indeed`…) */ sourceName?: string | null }

const GENERIC_NAME = "Sin nombre"

/** Nombre de la persona según el CV, o `undefined` si el CV no lo trae. */
export function personName(cv: CV): string | undefined {
  const n = cv.header.fullName?.trim()
  return n && n !== GENERIC_NAME ? n : undefined
}

const LINKEDIN = /linkedin\./i

/** Enlaces del CV que sirven de portafolio o web (se excluye LinkedIn). Máximo 2, en el orden del CV. */
export function webLinks(cv: CV): { label: string; url: string }[] {
  return cv.header.links.filter((l) => l.url && !LINKEDIN.test(l.url)).slice(0, 2)
}

/** Asunto: el que pide la oferta (con marcadores rellenados) o la plantilla «Postulación: {cargo} – {nombre}» («Application: …» en inglés). */
export function buildSubject(input: { detected?: string; cv: CV; job: EmailJob; lang?: Lang }): { text: string; fromOffer: boolean; pending: boolean } {
  const name = personName(input.cv)
  const title = input.job.title.trim()
  if (input.detected) {
    const f = fillSubject(input.detected, { name, title })
    return { text: f.text, fromOffer: true, pending: f.pending }
  }
  return { text: [`${input.lang === "en" ? "Application" : "Postulación"}: ${title}`, name].filter(Boolean).join(" – "), fromOffer: false, pending: false }
}

/** Coincidencias reales con la oferta (las que el CV cubre), sin repetir, máximo 3. */
export function pickMatches(covered: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of covered.map((x) => x.trim()).filter(Boolean)) {
    const k = c.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(c)
    if (out.length === 3) break
  }
  return out
}

/** Datos de contacto que la persona deja salir en la firma (cada uno solo existe si el CV lo trae). */
export type ContactData = { phone: boolean; email: boolean; city: boolean; linkedin: boolean; web: boolean; /** «Vi su publicación en LinkedIn» */ source: boolean }
/** Por defecto: teléfono, correo, portafolio y dónde se vio la oferta; la ciudad y LinkedIn quedan apagados. */
export const DEFAULT_CONTACT: ContactData = { phone: true, email: true, city: false, linkedin: false, web: true, source: true }

/** Lo que la persona escribe para responder a lo que pide la oferta (solo texto suyo; vacío = no se agrega). */
export type AskValues = { salario?: string; disponibilidad?: string; referencias?: string; /** enlace a LinkedIn si el CV no trae uno */ linkedin?: string }

/** Enlace de LinkedIn del CV, si lo trae. */
export function linkedinLink(cv: CV): { label: string; url: string } | undefined {
  return cv.header.links.find((l) => l.url && LINKEDIN.test(l.url))
}

const PLATFORM_LABEL: Record<string, string> = { linkedin: "LinkedIn", indeed: "Indeed", computrabajo: "Computrabajo", getonbrd: "Get on Board", elempleo: "elempleo", magneto: "Magneto", torre: "Torre", workana: "Workana" }
/** Nombre de la plataforma donde se vio la oferta, si la fuente es un portal conocido (si no, no se menciona). */
export function platformLabel(sourceName?: string | null): string | undefined {
  return sourceName ? PLATFORM_LABEL[sourceName.trim().toLowerCase()] : undefined
}

/** Estilo fijo del correo (las partes que arma el programa, no la IA): idioma, saludo, cierre y a quién va dirigido. */
export type EmailStyle = { lang: Lang; greeting: BodySettings["greeting"]; cta: BodySettings["cta"]; /** nombre de quien recibe, si la persona lo escribió */ recipientName?: string }
export const DEFAULT_STYLE: EmailStyle = { lang: "es", greeting: "equipo", cta: "conversar" }

const TEXT = {
  es: {
    simple: "Hola:",
    team: (c?: string) => (c ? `Hola, equipo de ${c}:` : "Hola:"),
    formal: (c?: string) => `Estimado equipo de selección${c ? ` de ${c}` : ""}:`,
    named: (n: string) => `Hola, ${n}:`,
    intro: (title: string, source?: string) => `Me interesa la vacante de ${title}${source ? ` que vi publicada en ${source}` : ""} y te comparto mi hoja de vida para que la consideren.`,
    points: "Algunos puntos de mi perfil que encajan con lo que buscan:",
    attached: "Adjunto mi CV.",
    cta: { conversar: "Quedo atento/a para conversar cuando les convenga.", entrevista: "Me encantaría tener la oportunidad de conversar con ustedes en una entrevista.", agradecer: "Gracias por considerar mi postulación.", ninguno: "" },
    thanks: "Gracias por el tiempo.",
    asks: { salario: "Aspiración salarial", disponibilidad: "Disponibilidad", referencias: "Referencias" },
    web: "Web",
  },
  en: {
    simple: "Hello:",
    team: (c?: string) => (c ? `Hello, ${c} team:` : "Hello:"),
    formal: (c?: string) => `Dear ${c ? `${c} ` : ""}Hiring Team:`,
    named: (n: string) => `Hello, ${n}:`,
    intro: (title: string, source?: string) => `I am interested in the ${title} position${source ? ` I saw on ${source}` : ""}, and I am sharing my résumé for your consideration.`,
    points: "A few points where my profile matches what you are looking for:",
    attached: "My CV is attached.",
    cta: { conversar: "I would be glad to talk whenever it suits you.", entrevista: "I would love the chance to discuss the role with you in an interview.", agradecer: "Thank you for considering my application.", ninguno: "" },
    thanks: "Thank you for your time.",
    asks: { salario: "Salary expectation", disponibilidad: "Availability", referencias: "References" },
    web: "Web",
  },
} as const

type BodyInput = {
  cv: CV
  job: EmailJob
  covered: string[]
  /** propuesta (IA o plantilla) que reemplaza el bloque de coincidencias */
  middle?: string
  contact: ContactData
  asks?: AskValues
  /** portafolio/web a usar en vez de los del CV (p. ej. el que la persona agregó a mano) */
  links?: { label: string; url: string }[]
  style?: Partial<EmailStyle>
}

/**
 * Cuerpo del correo. `covered` = lo que el CV cubre de la oferta (de `/api/jobs/[id]/fit`); con menos de 2 se omite ese bloque. Todo dato sale del CV,
 * de la oferta o de lo que la persona escribió; la firma lleva solo lo que ella dejó encendido y el CV tiene. Un `asks` vacío no agrega nada.
 * El saludo, el cierre y el idioma salen de `style` (por defecto: español, «Hola, equipo de X», quedar atento a conversar).
 */
export function buildBody(input: BodyInput): string {
  const { cv, job, contact } = input
  const st = { ...DEFAULT_STYLE, ...input.style }
  const T = TEXT[st.lang]
  const name = personName(cv)
  const matches = pickMatches(input.covered)
  const company = job.company?.trim()
  const source = contact.source ? platformLabel(job.sourceName) : undefined
  const parts: string[] = []
  const recipient = st.recipientName?.trim()
  parts.push(recipient ? T.named(recipient) : st.greeting === "simple" ? T.simple : st.greeting === "formal" ? T.formal(company) : T.team(company))
  parts.push(T.intro(job.title.trim(), source))
  if (input.middle?.trim()) parts.push(input.middle.trim())
  else if (matches.length >= 2) parts.push([T.points, ...matches.map((m) => `• ${m}`)].join("\n"))
  const a = input.asks ?? {}
  const asked = [a.salario?.trim() && `${T.asks.salario}: ${a.salario.trim()}`, a.disponibilidad?.trim() && `${T.asks.disponibilidad}: ${a.disponibilidad.trim()}`, a.referencias?.trim() && `${T.asks.referencias}: ${a.referencias.trim()}`].filter(Boolean) as string[]
  if (asked.length) parts.push(asked.join("\n"))
  parts.push([T.attached, T.cta[st.cta]].filter(Boolean).join(" "))
  if (st.cta !== "agradecer") parts.push(T.thanks)

  const contactLine = [contact.phone && cv.header.phone?.trim(), contact.email && cv.header.email?.trim(), contact.city && cv.header.location?.trim()].filter(Boolean).join(" · ")
  const linkedin = contact.linkedin ? (linkedinLink(cv)?.url ?? a.linkedin?.trim()) : undefined
  const web = contact.web ? (input.links ?? webLinks(cv)) : []
  const sign = [name, contactLine, linkedin && `LinkedIn: ${linkedin}`, ...web.map((l) => `${l.label || T.web}: ${l.url}`)].filter(Boolean)
  if (sign.length) parts.push(sign.join("\n"))
  return parts.join("\n\n")
}
