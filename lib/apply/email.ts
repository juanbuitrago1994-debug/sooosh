import type { CV } from "@/lib/schemas/cv"
import { fillSubject } from "@/lib/jobs/subject"

/**
 * Texto base del correo de postulación (plantilla pura, sin IA). Regla de oro: **nada se inventa**. Cada dato del correo sale del CV
 * de la persona o de la oferta; si falta, esa línea se omite (nunca queda un `{campo}` a la vista). Siempre de «tú».
 */
export type EmailJob = { title: string; company?: string | null }

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

/** Asunto: el que pide la oferta (con marcadores rellenados) o la plantilla «Postulación: {cargo} – {nombre}». */
export function buildSubject(input: { detected?: string; cv: CV; job: EmailJob }): { text: string; fromOffer: boolean; pending: boolean } {
  const name = personName(input.cv)
  const title = input.job.title.trim()
  if (input.detected) {
    const f = fillSubject(input.detected, { name, title })
    return { text: f.text, fromOffer: true, pending: f.pending }
  }
  return { text: [`Postulación: ${title}`, name].filter(Boolean).join(" – "), fromOffer: false, pending: false }
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

/**
 * Cuerpo del correo. `covered` = lo que el CV cubre de la oferta (de `/api/jobs/[id]/fit`); con menos de 2 se omite ese bloque. Con `middle`
 * (propuesta de la IA o de plantilla) reemplaza ese bloque. `links` (portafolio o web) manda sobre los del CV si se pasa.
 */
export function buildBody(input: { cv: CV; job: EmailJob; covered: string[]; includeWeb: boolean; middle?: string; links?: { label: string; url: string }[] }): string {
  const { cv, job } = input
  const name = personName(cv)
  const matches = pickMatches(input.covered)
  const company = job.company?.trim()
  const parts: string[] = []
  parts.push(company ? `Hola, equipo de ${company}:` : "Hola:")
  parts.push(`Me interesa la vacante de ${job.title.trim()} y te comparto mi hoja de vida para que la consideren.`)
  if (input.middle?.trim()) parts.push(input.middle.trim())
  else if (matches.length >= 2) parts.push(["Algunos puntos de mi perfil que encajan con lo que buscan:", ...matches.map((m) => `• ${m}`)].join("\n"))
  const links = input.includeWeb ? (input.links ?? webLinks(cv)) : []
  if (links.length) parts.push(links.map((l) => `${l.label || "Web"}: ${l.url}`).join("\n"))
  parts.push("Adjunto mi CV. Quedo atento/a para conversar cuando les convenga.")
  parts.push("Gracias por el tiempo.")
  const sign = [name, cv.header.phone?.trim(), cv.header.email?.trim()].filter(Boolean)
  if (sign.length) parts.push([sign[0], sign.slice(1).join(" · ")].filter(Boolean).join("\n"))
  return parts.join("\n\n")
}
