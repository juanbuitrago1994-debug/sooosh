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
  const years = [...rest.matchAll(YEAR_RE)]
  let date: string | undefined
  const last = years[years.length - 1]
  // El año solo es «la fecha» si va al final o entre paréntesis; un año dentro del nombre («Scrum 2020 Guide») se queda.
  if (last && new RegExp(`[(\\s,|–—-]*\\(?${last[1]}\\)?[).\\s]*$`).test(rest)) {
    date = last[1]
    rest = rest.slice(0, last.index).replace(/[(\s,|–—-]+$/, "").trim()
  }
  const parts = rest.split(SEP).map((p) => p.replace(/^[\s,;:]+|[\s,;:]+$/g, "")).filter(Boolean)
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
      const head = b.head.map((l) => (m ? l.replace(m[0], "") : l).replace(/[(\s,|–—-]+$/, "").trim()).filter(Boolean)
      const det = parseJobHead(head)
      return {
        organization: clip(oneLine(det.company ?? head[0] ?? ""), 160),
        role: det.company && det.role ? clip(oneLine(det.role), 120) : undefined,
        startDate: m ? m[1].trim() : undefined,
        endDate: m ? m[2].trim() : undefined,
        bullets: b.bullets.map((x) => clip(oneLine(x), 400)).filter(Boolean),
      }
    })
    .filter((v) => v.organization)
}
