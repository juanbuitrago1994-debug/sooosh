import { fold } from "@/lib/keywords/normalize"
import type { CV } from "@/lib/schemas/cv"
import { formatRange, sortKey, type DateIssue } from "./dates"
import { ATS_HEADINGS, ATS_LABELS, ATS_ORDER, type AtsLang, type AtsSectionKey } from "./headings"
import { detectLang, type LangDetection } from "./lang"

/**
 * Modelo del CV en formato ATS (Fase A2). Lo arma el CÓDIGO, no la IA: orden fijo de secciones, encabezados estándar, separadores ` | ` y ` — `,
 * fechas «Mes Año», habilidades separadas por comas y viñetas simples. Todo el contenido sale del CV que subió la persona; lo único que se
 * añade son los textos fijos de `ATS_HEADINGS`/`ATS_LABELS`. Ver docs/CONOCIMIENTO-ATS.md (§3 reglas, §5 plantilla).
 */
export type AtsBlock = { kind: "entry"; head: string; lines: string[]; bullets: string[] } | { kind: "para"; text: string }
export type AtsSection = { key: AtsSectionKey; title: string; blocks: AtsBlock[] }

export type AtsWarningCode = "lang-undetermined" | "lang-other" | "date-year-only" | "date-unparsed" | "order-kept" | "no-experience" | "no-contact" | "summary-missing" | "title-abbrev"
export type AtsWarning = { code: AtsWarningCode; message: string }

export type AtsDoc = {
  lang: AtsLang
  langDetection: LangDetection
  name: string
  /** Cargo o titular del original (una línea bajo el nombre), si lo traía. */
  headline: string
  /** Línea de contacto: «Ciudad | Teléfono | correo | enlaces». */
  contact: string
  /** Rol para el nombre del archivo: el titular, o el cargo más reciente. */
  fileRole: string
  sections: AtsSection[]
  summarySource: "cv" | "ia" | "none"
  warnings: AtsWarning[]
}

const BULLET_LEAD = /^[\s•·▪▫■□◦‣⁃●○◆◇➢➤►▶*\-–—]+/
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim()
export const cleanBullet = (s: string) => oneLine(s.replace(BULLET_LEAD, ""))
const clean = (xs: (string | undefined)[]) => xs.map((x) => (x ? oneLine(x) : "")).filter(Boolean)

function dedupe(xs: string[]): string[] {
  const seen = new Set<string>()
  return xs.filter((x) => {
    const k = fold(x)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Orden cronológico inverso (ATS-S4). Si alguna fecha no se entiende, no se toca el orden del original y se avisa. */
function reverseChrono<T>(items: T[], start: (t: T) => string | undefined, end: (t: T) => string | undefined): { items: T[]; kept: boolean } {
  const keyed = items.map((it, i) => {
    const s = sortKey(start(it), "start")
    const e = sortKey(end(it), "end")
    return { it, i, s, e: e ?? s }
  })
  if (keyed.some((k) => k.e == null)) return { items, kept: items.length > 1 }
  const sorted = [...keyed].sort((a, b) => (b.e as number) - (a.e as number) || (b.s ?? 0) - (a.s ?? 0) || a.i - b.i)
  return { items: sorted.map((k) => k.it), kept: false }
}

/** Abreviaturas de cargo que los ATS leen peor (ATS-E10: «Sr. Account Exec» frente a «Senior Account Executive»). Solo las inequívocas. */
const TITLE_ABBREV: Record<string, string> = { sr: "Senior", jr: "Junior", ssr: "Semi Senior" }
const ABBREV_RE = /(?<![\p{L}\d])(sr|jr|ssr)\.?(?![\p{L}\d])/giu

/** Escribe completas las abreviaturas de un cargo; devuelve el texto y lo que cambió. */
export function spellTitle(title: string): { text: string; changed: { from: string; to: string }[] } {
  const changed: { from: string; to: string }[] = []
  const text = title.replace(ABBREV_RE, (m, k: string) => {
    const to = TITLE_ABBREV[k.toLowerCase()]
    changed.push({ from: m, to })
    return to
  })
  return { text, changed }
}

const ISSUE_TEXT: Record<DateIssue, { code: AtsWarningCode; text: (raw: string) => string }> = {
  "year-only": { code: "date-year-only", text: (r) => `La fecha «${r}» solo trae el año: no se agregó un mes que el CV no dice.` },
  unparsed: { code: "date-unparsed", text: (r) => `No se entendió la fecha «${r}»: se dejó tal cual.` },
}

export function buildAtsDoc(cv: CV, opts: { lang?: AtsLang; summary?: string } = {}): AtsDoc {
  const detection = detectLang(cv)
  const lang = opts.lang ?? detection.lang
  const warnings: AtsWarning[] = []
  const warn = (code: AtsWarningCode, message: string) => {
    if (!warnings.some((w) => w.code === code && w.message === message)) warnings.push({ code, message })
  }
  if (!opts.lang) {
    if (detection.detected === "otro") warn(detection.scores.es + detection.scores.en < 2 ? "lang-undetermined" : "lang-other", `No se pudo identificar el idioma del CV como español o inglés: se usó ${lang === "es" ? "español" : "inglés"} en los títulos de sección.`)
  }

  const range = (a: string | undefined, b: string | undefined) => {
    const r = formatRange(a, b, lang)
    for (const i of r.issues) warn(ISSUE_TEXT[i.issue].code, ISSUE_TEXT[i.issue].text(i.raw))
    return r.text
  }
  const title = (t: string) => {
    const r = spellTitle(oneLine(t))
    for (const c of r.changed) warn("title-abbrev", `En el cargo «${oneLine(t)}» se escribió «${c.from}» como «${c.to}» (los ATS leen mejor los cargos sin abreviaturas). Revisa que sea lo que querías decir.`)
    return r.text
  }
  const withDate = (head: string, date: string) => (date ? `${head} | ${date}` : head)

  // Experiencia y educación en orden cronológico inverso
  const exp = reverseChrono(cv.experience, (e) => e.startDate, (e) => e.endDate)
  const edu = reverseChrono(cv.education, (e) => e.startDate, (e) => e.endDate)
  if (exp.kept || edu.kept) warn("order-kept", "No se pudo ordenar por fecha (alguna no se entiende): se respetó el orden del CV original.")

  const summaryText = (cv.summary?.trim() ? cv.summary : opts.summary)?.trim()
  const summarySource: AtsDoc["summarySource"] = cv.summary?.trim() ? "cv" : opts.summary?.trim() ? "ia" : "none"

  const bodies: Record<AtsSectionKey, AtsBlock[]> = {
    summary: summaryText ? [{ kind: "para", text: oneLine(summaryText) }] : [],
    experience: exp.items.map((e) => ({
      kind: "entry" as const,
      head: withDate(`${title(e.role)} — ${clean([e.company, e.location]).join(", ")}`, range(e.startDate, e.endDate)),
      lines: [],
      bullets: e.bullets.map(cleanBullet).filter(Boolean),
    })),
    education: edu.items.map((e) => {
      const title = clean([e.degree, e.field]).join(", ")
      return {
        kind: "entry" as const,
        head: withDate(title ? `${title} — ${oneLine(e.institution)}` : oneLine(e.institution), range(e.startDate, e.endDate)),
        lines: [],
        bullets: e.details.map(cleanBullet).filter(Boolean),
      }
    }),
    skills: cv.skills
      .map((g) => ({ category: g.category ? oneLine(g.category) : "", items: dedupe(clean(g.items)) }))
      .filter((g) => g.items.length)
      .map((g) => ({ kind: "para" as const, text: `${g.category ? `${g.category}: ` : ""}${g.items.join(", ")}` })),
    languages: cv.languages.length ? [{ kind: "para", text: cv.languages.map((l) => clean([l.name, l.level && `(${oneLine(l.level)})`]).join(" ")).join(", ") }] : [],
    projects: cv.projects.map((p) => ({
      kind: "entry" as const,
      head: clean([p.name, p.url]).join(" | "),
      lines: clean([p.description, p.technologies.length ? `${ATS_LABELS[lang].technologies}: ${clean(p.technologies).join(", ")}` : undefined]),
      bullets: p.bullets.map(cleanBullet).filter(Boolean),
    })),
  }

  const headings = ATS_HEADINGS[lang]
  const sections = ATS_ORDER.map((key) => ({ key, title: headings[key], blocks: bodies[key] })).filter((s) => s.blocks.length)

  const contact = dedupe(clean([cv.header.location, cv.header.phone, cv.header.email, ...cv.header.links.map((l) => l.url)])).join(" | ")
  if (!contact) warn("no-contact", "El CV no trae datos de contacto (correo, teléfono o ciudad).")
  if (!cv.experience.length) warn("no-experience", "El CV no trae experiencia laboral: la sección no aparece.")
  if (summarySource === "none") warn("summary-missing", "El CV no trae resumen y no se generó uno: la sección no aparece.")

  const headline = cv.header.headline ? title(cv.header.headline) : ""
  return { lang, langDetection: detection, name: oneLine(cv.header.fullName), headline, contact, fileRole: headline || (exp.items[0] ? title(exp.items[0].role) : ""), sections, summarySource, warnings }
}
