import { fold } from "@/lib/keywords/normalize"

const MONTH = "(?:ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic|jan|apr|aug|dec)[a-z]*\\.?"
const YEAR = "(?:19|20)\\d{2}"
const DAY = "(?:\\d{1,2}\\s*(?:de\\s+)?)?" // «06 nov 2026», «11ago 2025» (el OCR pega el día al mes)
const DATE = `(?:${DAY}${MONTH}\\s*(?:de\\s+)?${YEAR}|\\d{1,2}[/-]${YEAR}|${YEAR})`
const OPEN = "(?:actualidad|actual|presente|present|current|hoy|a la fecha|la fecha|now|en curso)" // la palabra más larga primero: con «actual» antes, «Actualidad» dejaba «idad» pegado a la empresa
export const RANGE_RE = new RegExp(`(${DATE})\\s*(?:-|–|—|a|al|to|hasta)\\s*(${DATE}|${OPEN})`, "i")

const MONTHS: Record<string, number> = { ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12 }

export function parseDate(s: string): { y: number; m: number } | null {
  const t = fold(s)
  const y = t.match(/(?:19|20)\d{2}/)?.[0]
  if (!y) return null
  const mm = t.match(/(?<![a-z])(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic|jan|apr|aug|dec)/)?.[1]
  const num = t.match(/\b(\d{1,2})[/-](?:19|20)\d{2}/)?.[1]
  return { y: Number(y), m: mm ? MONTHS[mm] : num ? Math.min(12, Number(num)) : 1 }
}

export const isOpen = (s: string) => new RegExp(`^${OPEN}$`, "i").test(s.trim())

/** Años de experiencia: une los periodos (sin contar dos veces los solapados). */
export function totalYears(ranges: { start: string; end?: string }[], now = new Date()): number | null {
  const iv = ranges
    .map((r) => {
      const a = parseDate(r.start)
      const b = !r.end || isOpen(r.end) ? { y: now.getFullYear(), m: now.getMonth() + 1 } : parseDate(r.end)
      return a && b ? [a.y * 12 + a.m, b.y * 12 + b.m] : null
    })
    .filter((x): x is number[] => !!x && x[1] >= x[0])
    .sort((p, q) => p[0] - q[0])
  if (iv.length === 0) return null
  // Meses inclusivos: "Ene 2020 – Dic 2020" son 12 meses, no 11.
  let total = 0
  let [s, e] = iv[0]
  for (const [a, b] of iv.slice(1)) {
    if (a <= e) e = Math.max(e, b)
    else {
      total += e - s + 1
      ;[s, e] = [a, b]
    }
  }
  total += e - s + 1
  return Math.round((total / 12) * 10) / 10
}
