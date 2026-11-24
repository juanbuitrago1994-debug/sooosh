import { isOpen } from "@/lib/cv/dates"
import { fold } from "@/lib/keywords/normalize"
import { ATS_LABELS, type AtsLang } from "./headings"

/**
 * Fechas del CV ATS (reglas ATS-E2 y ATS-E3): un solo formato numérico, «MM/AAAA – MM/AAAA» o «MM/AAAA – Presente». Decisión de Juan del
 * 23-nov-2026, basada en una prueba con el lector de Enhancv: leyó «03/2021» y no leyó «Marzo 2021» (docs/CONOCIMIENTO-ATS.md, C6). El
 * formato numérico además no depende del idioma. Nunca se inventa un mes: si el original solo trae el año, se deja el año y se avisa.
 */
export const MONTH_NAMES: Record<AtsLang, string[]> = {
  es: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
}

const MONTH_KEYS: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1,
  feb: 2, febrero: 2, february: 2,
  mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6, june: 6,
  jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  sep: 9, sept: 9, set: 9, septiembre: 9, setiembre: 9, september: 9,
  oct: 10, octubre: 10, october: 10,
  nov: 11, noviembre: 11, november: 11,
  dic: 12, diciembre: 12, dec: 12, december: 12,
}

export type DateParts = { year: number; month: number | null }

/** Año y (si lo trae) mes de una fecha escrita como «Mar 2021», «03/2021», «2021-03», «Marzo de 2021» o «2021». */
export function parseParts(raw: string): DateParts | null {
  const t = fold(raw).replace(/\./g, " ")
  const year = t.match(/(?<!\d)((?:19|20)\d{2})(?!\d)/)?.[1]
  if (!year) return null
  const num = t.match(/(?<!\d)(\d{1,2})\s*[/-]\s*(?:19|20)\d{2}/)?.[1] ?? t.match(/(?:19|20)\d{2}\s*[/-]\s*(\d{1,2})(?!\d)/)?.[1]
  if (num && Number(num) >= 1 && Number(num) <= 12) return { year: Number(year), month: Number(num) }
  const word = (t.match(/[a-z]+/g) ?? []).find((w) => w in MONTH_KEYS)
  return { year: Number(year), month: word ? MONTH_KEYS[word] : null }
}

export type DateIssue = "year-only" | "unparsed"
export type FormattedDate = { text: string; issue?: DateIssue }

export function formatDate(raw: string, lang: AtsLang): FormattedDate {
  const s = raw.trim()
  if (isOpen(s)) return { text: ATS_LABELS[lang].present }
  const p = parseParts(s)
  if (!p) return { text: s, issue: "unparsed" }
  if (p.month == null) return { text: String(p.year), issue: "year-only" }
  return { text: `${String(p.month).padStart(2, "0")}/${p.year}` }
}

export type FormattedRange = { text: string; issues: { raw: string; issue: DateIssue }[] }

/** «05/2023 – Presente». Sin fecha de fin, solo la de inicio; sin ninguna, vacío. */
export function formatRange(start: string | undefined, end: string | undefined, lang: AtsLang): FormattedRange {
  const parts = [start, end].map((x) => x?.trim()).filter((x): x is string => !!x)
  const done = parts.map((p) => ({ raw: p, ...formatDate(p, lang) }))
  return { text: done.map((d) => d.text).join(" – "), issues: done.filter((d) => d.issue).map((d) => ({ raw: d.raw, issue: d.issue as DateIssue })) }
}

/** Clave numérica para ordenar (meses desde el año 0); null si no se entiende. Una fecha abierta («Actual») es la más reciente. */
export function sortKey(raw: string | undefined, kind: "start" | "end"): number | null {
  const s = raw?.trim()
  if (!s) return null
  if (isOpen(s)) return Number.POSITIVE_INFINITY
  const p = parseParts(s)
  return p ? p.year * 12 + (p.month ?? (kind === "end" ? 12 : 1)) : null
}
