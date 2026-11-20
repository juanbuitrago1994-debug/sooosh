/**
 * Salario de una oferta, solo cuando la fuente lo dice con moneda explícita. Un «$» suelto NO se interpreta (en Colombia, Chile,
 * Argentina y México es peso, pero en una oferta remota puede ser dólar): sin moneda clara no se muestra salario.
 */
export const CURRENCIES = ["COP", "CLP", "ARS", "MXN", "PEN", "UYU", "BRL", "USD", "EUR"] as const
export const PERIODS = ["mes", "año", "hora"] as const
export type Salary = { min?: number; max?: number; currency: (typeof CURRENCIES)[number]; period: (typeof PERIODS)[number] }

const CURRENCY_WORDS: [RegExp, Salary["currency"]][] = [
  [/\bCOP\b|pesos? colombianos?/i, "COP"],
  [/\bCLP\b|pesos? chilenos?/i, "CLP"],
  [/\bARS\b|pesos? argentinos?/i, "ARS"],
  [/\bMXN\b|pesos? mexicanos?/i, "MXN"],
  [/\bPEN\b|soles?\b/i, "PEN"],
  [/\bUYU\b|pesos? uruguayos?/i, "UYU"],
  [/\bBRL\b|reales\b|R\$/i, "BRL"],
  [/\bUSD\b|US\$|U\$S|d[oó]lares?|dollars?/i, "USD"],
  [/\bEUR\b|€|euros?/i, "EUR"],
]
const SALARY_CUE = /(salario|sueldo|remuneraci[oó]n|renta|compensaci[oó]n|pago|salary|compensation|pay)\b/i
// El sufijo (k, mil, millones, M) no puede ir pegado a otra letra: «6.000.000 mensuales» no es «6.000.000 M».
const NUM = "(\\d{1,3}(?:[.,\\s]\\d{3})+|\\d+(?:[.,]\\d+)?)\\s*(?:(k|mil|millones?|m)(?![a-záéíóúñ]))?"
const RANGE = new RegExp(`${NUM}\\s*(?:-|–|—|a|hasta|to)\\s*${NUM}`, "i")
const SINGLE = new RegExp(NUM, "i")

/** «4.500.000» / «4,500» / «4500» / «4k» / «4 millones» → número. */
export function parseAmount(raw: string, suffix?: string): number | null {
  let s = raw.replace(/\s/g, "")
  const groups = s.match(/[.,]\d{3}(?!\d)/g)
  if (groups && /^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "") // separadores de miles
  else s = s.replace(",", ".")
  let n = Number(s)
  if (!Number.isFinite(n)) return null
  const sfx = suffix?.toLowerCase()
  if (sfx === "k" || sfx === "mil") n *= 1000
  else if (sfx && /^m(illones?)?$/.test(sfx)) n *= 1_000_000
  return Math.round(n)
}

function periodOf(window: string): Salary["period"] {
  if (/\b(por hora|\/\s?h(ora)?\b|per hour|hourly|\/hr)\b/i.test(window)) return "hora"
  if (/\b(anual|al a[nñ]o|por a[nñ]o|per year|annual|yearly|\/\s?a[nñ]o)\b/i.test(window)) return "año"
  return "mes" // lo habitual en la región; solo se muestra junto a una moneda explícita
}

/**
 * Busca una frase con cifra + moneda explícita cerca de una palabra de salario. Devuelve null si no hay certeza.
 * (Una cifra dentro del texto de requisitos, como «USD 10.000 de presupuesto», no cuenta: se exige la palabra de salario.)
 */
export function detectSalary(text: string): Salary | null {
  for (const m of text.matchAll(new RegExp(SALARY_CUE, "gi"))) {
    const start = m.index ?? 0
    const window = text.slice(Math.max(0, start - 20), start + 140).split("\n").slice(0, 2).join(" ")
    const currency = CURRENCY_WORDS.find(([re]) => re.test(window))?.[1]
    if (!currency) continue
    const period = periodOf(window)
    const floor = period === "hora" ? 2 : 100 // por hora, 25 es un monto normal; al mes, 25 no
    const r = RANGE.exec(window)
    const lo = r ? parseAmount(r[1], r[2] ?? r[4]) : null
    const hi = r ? parseAmount(r[3], r[4]) : null
    if (r && lo && hi && hi >= lo && lo >= floor) return { min: lo, max: hi, currency, period }
    const one = SINGLE.exec(window.slice(window.search(/\d/)))
    const v = one ? parseAmount(one[1], one[2]) : null
    if (v && v >= floor) return { min: v, currency, period }
  }
  return null
}

export function formatSalary(s: Salary): string {
  const f = (n: number) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(n)
  const amount = s.min && s.max && s.max !== s.min ? `${f(s.min)} – ${f(s.max)}` : f((s.min ?? s.max) as number)
  const per = s.period === "mes" ? "al mes" : s.period === "año" ? "al año" : "por hora"
  return `${s.currency} ${amount} ${per}`
}
