import type { CV } from "@/lib/schemas/cv"
import { bulletItems, isBullet, splitBlocks } from "./blocks"
import { RANGE_RE } from "./dates"
import { parseJobHead } from "./heads"

/**
 * Secciones que no son la columna vertebral del CV (certificaciones, voluntariado, premios, publicaciones), leídas SIN IA.
 * Todo lo que devuelven es texto copiado del original: se parte por separadores («—», «|», « - ») y se reconoce un año o un rango de fechas; nada se inventa.
 */
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim()
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s)
const YEAR_RE = /\b((?:19|20)\d{2})\b/g
const MONTH_YEAR = "(?:(?:ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic|jan|apr|aug|dec)[a-z]*\\.?\\s+)?(?:19|20)\\d{2}"
/** Una parte que es SOLO una fecha o un rango («Feb 2026», «Oct 2025 – Dic 2025», «2024», «En curso», «Jun 2026 – Actualidad»). */
const DATE_PART = new RegExp(`^(?:${MONTH_YEAR}(?:\\s*[-–—]\\s*(?:${MONTH_YEAR}|actualidad|presente|present|en curso|current))?|en curso|in progress|actualidad)$`, "i")
const URL_RE = /(?:https?:\/\/|www\.)\S+/i
const SEP = /\s[—–|]\s|\s-\s/

/** Una entrada por viñeta; sin viñetas, una por línea. */
function items(text: string): string[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  if (lines.some(isBullet)) return bulletItems(text)
  return lines
}

type Piece = { parts: string[]; date?: string; url?: string }

function piece(item: string): Piece {
  let rest = oneLine(item)
  // Solo enlaces escritos como tales (https://… o www.…): «Scrum.org» es el nombre de una entidad, no un enlace.
  const url = URL_RE.exec(rest)?.[0].replace(/[).,;]+$/, "")
  if (url) rest = rest.replace(URL_RE, "").replace(/\(\s*\)/g, "").trim()
  let date: string | undefined
  // 1) Un rango de fechas («Jun 2026 – Ago 2026») se saca ANTES de partir: su guion no es un separador.
  const range = RANGE_RE.exec(rest)
  if (range) {
    date = range[0].trim()
    rest = `${rest.slice(0, range.index)} | ${rest.slice(range.index + range[0].length)}`
  }
  // 2) Un año al final o entre paréntesis («… (2023)»). Un año dentro del nombre («Scrum 2020 Guide») se queda.
  const years = [...rest.matchAll(YEAR_RE)]
  const last = years[years.length - 1]
  // Si el año va precedido de un mes («Feb 2026») es la fecha completa de la parte suelta (paso 4), no solo el año.
  const monthBefore = !!last && /(?:ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic|jan|apr|aug|dec)[a-z]*\.?\s*$/i.test(rest.slice(0, last.index))
  if (!date && last && !monthBefore && new RegExp(`[(\\s,|–—-]*\\(?${last[1]}\\)?[).\\s]*$`).test(rest)) {
    date = last[1]
    rest = rest.slice(0, last.index).replace(/[(\s,|–—-]+$/, "").trim()
  }
  // 3) La barra «|» es el separador de campos cuando la hay («Título – subtítulo | Entidad | Fecha»); sin barras se parte por guiones y similares.
  const sep = /\s\|\s|\s\|$|^\|\s/.test(rest) ? /\s*\|\s*/ : SEP
  let parts = rest.split(sep).map((p) => p.replace(/^[\s,;:]+|[\s,;:]+$/g, "")).filter(Boolean)
  // 4) «Feb 2026», «2024», «En curso» como parte suelta: esa es la fecha, tal como está escrita.
  const at = date ? -1 : parts.findIndex((p, i) => i > 0 && DATE_PART.test(p))
  if (at > 0) {
    date = parts[at]
    parts = parts.filter((_, i) => i !== at)
  }
  return { parts, date, url }
}

export function parseCertifications(text: string): CV["certifications"] {
  return items(text)
    .map((it) => {
      const p = piece(it)
      return { name: clip(p.parts[0] ?? "", 200), issuer: p.parts[1] ? clip(p.parts.slice(1).join(" — "), 160) : undefined, date: p.date, url: p.url }
    })
    .filter((c) => c.name)
}

export function parseAwards(text: string): CV["awards"] {
  return items(text)
    .map((it) => {
      const p = piece(it)
      return { name: clip(p.parts[0] ?? "", 200), issuer: p.parts[1] ? clip(p.parts.slice(1).join(" — "), 160) : undefined, date: p.date, description: undefined }
    })
    .filter((a) => a.name)
}

export function parsePublications(text: string): CV["publications"] {
  return items(text)
    .map((it) => {
      const p = piece(it)
      return { title: clip(p.parts[0] ?? "", 200), publisher: p.parts[1] ? clip(p.parts.slice(1).join(" — "), 160) : undefined, date: p.date, url: p.url }
    })
    .filter((x) => x.title)
}

export function parseVolunteering(text: string): CV["volunteering"] {
  const blocks = splitBlocks(text)
  if (blocks.length === 0) {
    // Entradas de una línea («Mentor en Fundación X — 2022»): la organización es lo que se leyó, sin partirlo.
    return items(text)
      .map((it) => {
        const m = RANGE_RE.exec(it)
        const p = piece(m ? it.replace(m[0], "") : it)
        return { organization: clip(p.parts.join(" — "), 160), role: undefined, startDate: m ? m[1].trim() : p.date, endDate: m ? m[2].trim() : undefined, bullets: [] as string[] }
      })
      .filter((v) => v.organization)
  }
  return blocks
    .map((b) => {
      const headText = b.head.join(" · ")
      const m = RANGE_RE.exec(headText)
      const all = b.head.map((l) => (m ? l.replace(m[0], "") : l).replace(/[(\s,|–—-]+$/, "").trim()).filter(Boolean)
      // Lo que sigue a la cabecera y es una frase larga (o termina en punto) es la descripción de lo que hizo, no parte del nombre.
      const description = all.slice(1).filter((l) => l.length > 40 || /[.]$/.test(l))
      const head = all.filter((l, i) => i === 0 || !description.includes(l))
      const det = parseJobHead(head)
      return {
        organization: clip(oneLine(det.company ?? head[0] ?? ""), 160),
        role: det.company && det.role ? clip(oneLine(det.role), 120) : undefined,
        startDate: m ? m[1].trim() : undefined,
        endDate: m ? m[2].trim() : undefined,
        bullets: [...description, ...b.bullets].map((x) => clip(oneLine(x), 400)).filter(Boolean),
      }
    })
    .filter((v) => v.organization)
}

/**
 * Una sección combinada («EDUCACIÓN Y CERTIFICACIONES») reúne estudios formales y certificaciones. Se reparte línea por línea, sin IA y sin
 * cambiar el texto: certificado, curso, diplomado, bootcamp o plataforma de cursos → certificación; universidad, instituto, título → estudio.
 */
const CERT_RE = /\b(certific\w*|certificate|diplomad\w*|cursos?|courses?|bootcamp|nanodegree|workshop|talleres?|exam|fluency|masterclass|coursera|udemy|platzi|coderhouse|domestika|edx|udacity|linkedin learning|ixdf|interaction design foundation|academy|en curso)\b/i

export function splitEducationAndCertifications(text: string): { education: string; certifications: string } {
  const edu: string[] = []
  const cert: string[] = []
  for (const raw of text.split("\n")) {
    const line = raw.trim()
    if (!line) continue
    ;(CERT_RE.test(line) ? cert : edu).push(line)
  }
  return { education: edu.join("\n"), certifications: cert.join("\n") }
}
