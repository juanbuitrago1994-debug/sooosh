const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  bull: "•", middot: "·", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", uuml: "ü", iexcl: "¡", iquest: "¿",
  laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      try {
        return String.fromCodePoint(code)
      } catch {
        return ""
      }
    }
    return ENTITIES[e] ?? m
  })
}

const BLOCK = "p|div|section|article|main|h[1-6]|ul|ol|table|tr|blockquote|pre|dl|dt|dd|fieldset"

function tidy(s: string): string {
  return decodeEntities(s)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** Fragmento HTML → texto plano con saltos de línea y viñetas. */
export function fragmentToText(html: string): string {
  return tidy(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(new RegExp(`</?(?:${BLOCK})[^>]*>`, "gi"), "\n")
      .replace(/<[^>]+>/g, " "),
  )
}

function stripNoise(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|svg|template|iframe|nav|footer|header|aside|form|button|select)\b[\s\S]*?<\/\1>/gi, "")
}

/** Datos estructurados que algunas páginas publican junto a la oferta (schema.org/JobPosting). Todos opcionales y tal como vienen. */
export type JobLd = {
  /** «Bogotá, Cundinamarca, CO» (localidad, región, país de `jobLocation`) */
  location?: string
  /** `jobLocationType: TELECOMMUTE` = 100 % remoto */
  remote?: boolean
  /** países desde los que se puede postular (`applicantLocationRequirements`) */
  applicantCountries?: string[]
  employmentType?: string
  datePosted?: string
  validThrough?: string
  /** `baseSalary` de schema.org: moneda explícita, rango y período */
  salary?: { min?: number; max?: number; currency: string; period: "mes" | "año" | "hora" }
}

const asArray = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v])
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined)

function jobLdMeta(o: Record<string, unknown>): JobLd {
  const places = asArray(o.jobLocation as Record<string, unknown> | Record<string, unknown>[] | undefined)
  const where = places
    .map((p) => {
      const a = (p?.address ?? {}) as Record<string, unknown>
      const country = typeof a.addressCountry === "object" && a.addressCountry ? str((a.addressCountry as Record<string, unknown>).name) : str(a.addressCountry)
      return [str(a.addressLocality), str(a.addressRegion), country].filter(Boolean).join(", ")
    })
    .filter(Boolean)
  const countries = asArray(o.applicantLocationRequirements as Record<string, unknown> | Record<string, unknown>[] | undefined)
    .map((c) => str(c?.name))
    .filter((c): c is string => !!c)
  const type = asArray(o.employmentType as string | string[] | undefined).map(str).filter(Boolean).join(", ")
  const bs = o.baseSalary as { currency?: unknown; value?: Record<string, unknown> } | undefined
  const unit = str(bs?.value?.unitText)?.toUpperCase()
  const num = (v: unknown) => (typeof v === "number" && v > 0 ? v : undefined)
  const sMin = num(bs?.value?.minValue) ?? num(bs?.value?.value)
  const sMax = num(bs?.value?.maxValue)
  const salary = str(bs?.currency) && (sMin || sMax) ? { min: sMin, max: sMax, currency: str(bs?.currency)!.toUpperCase(), period: unit === "YEAR" ? ("año" as const) : unit === "HOUR" ? ("hora" as const) : ("mes" as const) } : undefined
  return {
    salary,
    location: where[0],
    remote: str(o.jobLocationType)?.toUpperCase() === "TELECOMMUTE" ? true : undefined,
    applicantCountries: countries.length ? countries : undefined,
    employmentType: type || undefined,
    datePosted: str(o.datePosted),
    validThrough: str(o.validThrough),
  }
}

export function jobPostingFromJsonLd(html: string): { title?: string; company?: string; description: string; ld: JobLd } | null {
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const m of html.matchAll(re)) {
    let data: unknown
    try {
      data = JSON.parse(m[1])
    } catch {
      continue
    }
    const stack: unknown[] = [data]
    while (stack.length) {
      const n = stack.pop()
      if (Array.isArray(n)) stack.push(...n)
      else if (n && typeof n === "object") {
        const o = n as Record<string, unknown>
        const type = o["@type"]
        if ((type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) && typeof o.description === "string") {
          const org = o.hiringOrganization as { name?: unknown } | undefined
          return {
            title: typeof o.title === "string" ? o.title : undefined,
            company: typeof org?.name === "string" ? org.name : undefined,
            description: o.description,
            ld: jobLdMeta(o),
          }
        }
        if (o["@graph"]) stack.push(o["@graph"])
      }
    }
  }
  return null
}

/** Extrae el texto principal de una página de oferta. Sin servicios externos. */
export function htmlToText(html: string): string {
  const job = jobPostingFromJsonLd(html)
  if (job) {
    const body = fragmentToText(decodeEntities(job.description))
    if (body.length >= 200) {
      return [job.title, job.company, "", body].filter((x) => x !== undefined).join("\n").trim()
    }
  }

  const clean = stripNoise(html)
  const pick = (tag: string) => {
    const found = [...clean.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) => m[1])
    return found.sort((a, b) => b.length - a.length)[0]
  }
  const body = pick("main") ?? pick("article") ?? pick("body") ?? clean
  const title = clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const text = fragmentToText(body)
  return text.length < 200 && title ? tidy(`${title}\n\n${text}`) : text
}
