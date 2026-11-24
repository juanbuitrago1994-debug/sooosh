import { fold } from "@/lib/keywords/normalize"
import { comparable, type AtsExtras } from "./enrich"
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

export type AtsWarningCode = "lang-undetermined" | "lang-other" | "date-year-only" | "date-unparsed" | "order-kept" | "no-experience" | "no-contact" | "summary-missing" | "title-abbrev" | "summary-cut" | "extras-used"
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

const BULLET_LEAD = /^(?:[\s•·▪▫■□◦‣⁃●○◆◇➢➤►▶*\-–—]+|[+«»]\s+)+/
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

/**
 * Orden cronológico inverso (ATS-S4). Lo que NO trae fecha (un curso sin año, por ejemplo) no impide ordenar: queda al final en su orden
 * original y no genera aviso. Solo si alguna fecha está escrita pero no se entiende («verano») se respeta el orden del original y se avisa.
 */
function reverseChrono<T>(items: T[], start: (t: T) => string | undefined, end: (t: T) => string | undefined): { items: T[]; kept: boolean } {
  const keyed = items.map((it, i) => {
    const s = sortKey(start(it), "start")
    const e = sortKey(end(it), "end")
    const written = !!(start(it)?.trim() || end(it)?.trim())
    return { it, i, s, e: e ?? s, written }
  })
  if (keyed.some((k) => k.e == null && k.written)) return { items, kept: items.length > 1 }
  const dated = keyed.filter((k) => k.e != null).sort((a, b) => (b.e as number) - (a.e as number) || (b.s ?? 0) - (a.s ?? 0) || a.i - b.i)
  const undated = keyed.filter((k) => k.e == null)
  return { items: [...dated, ...undated].map((k) => k.it), kept: false }
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

const SKILLS_NOISE_ITEM = 40
const SKILLS_NOISE_TOTAL = 60
/** El análisis general a veces vuelca párrafos o porcentajes en «habilidades»: se reconoce por ítems largos o por cantidades absurdas. */
export function skillsLookBroken(cv: CV): boolean {
  const items = cv.skills.flatMap((g) => g.items)
  return items.length > SKILLS_NOISE_TOTAL || items.some((i) => i.length > SKILLS_NOISE_ITEM || /\d+\s*%/.test(i))
}

const SUMMARY_MAX_CHARS = 400
const SUMMARY_MAX_SENTENCES = 4
/** Un resumen largo se corta en una frase completa (ATS-S3: 2–4 líneas). Solo quita frases del final; no reescribe nada. */
export function trimSummary(text: string): { text: string; cut: boolean } {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [text]
  const kept: string[] = []
  for (const s of sentences) {
    if (kept.length >= SUMMARY_MAX_SENTENCES || [...kept, s].join(" ").length > SUMMARY_MAX_CHARS) break
    kept.push(s)
  }
  const out = kept.length ? kept.join(" ") : text.slice(0, SUMMARY_MAX_CHARS)
  return { text: out, cut: out.length < text.length }
}

const companyHits = (extras: AtsExtras | undefined, company: string) => {
  const c = comparable(company)
  return (extras?.roles ?? []).filter((r) => {
    const x = comparable(r.company)
    return !!x && !!c && (x === c || x.includes(c) || c.includes(x))
  })
}
const roleMatches = (r: { role?: string }, role: string) => {
  if (!r.role) return false
  const a = comparable(r.role)
  const b = comparable(role)
  return !!a && !!b && (a === b || a.includes(b) || b.includes(a))
}

/**
 * El CV con lo que la lectura profunda recuperó del texto original (A5): viñetas de los puestos que quedaron vacíos, habilidades cuando
 * el análisis general las rompió y proyectos si no había. Nunca pisa lo que ya estaba bien. El verificador compara contra este CV.
 */
/** El análisis general rompió la experiencia: puestos sin viñetas o campos que son párrafos (empresa o cargo de más de 80 caracteres). */
export function experienceLooksBroken(cv: CV): boolean {
  if (!cv.experience.length) return false
  const empty = cv.experience.filter((e) => !e.bullets.some((b) => cleanBullet(b))).length
  return empty / cv.experience.length >= 0.3 || cv.experience.some((e) => e.company.length > 80 || e.role.length > 80)
}

export function withExtras(cv: CV, extras: AtsExtras | undefined): CV {
  if (!extras) return cv
  // Con la experiencia rota, manda la lectura del texto original (cada campo está anclado a él); las fechas que no se pudieron anclar se toman del puesto del análisis general que coincide.
  const readRoles = extras.roles.filter((r) => r.role && comparable(r.role))
  if (experienceLooksBroken(cv) && readRoles.length >= 2) {
    const experience = readRoles.map((r) => {
      const twin = cv.experience.find((e) => companyHits({ ...extras, roles: [r] }, e.company).length && (roleMatches(r, e.role) || cv.experience.filter((x) => companyHits({ ...extras, roles: [r] }, x.company).length).length === 1))
      const year = (d?: string) => d?.match(/(?:19|20)\d{2}/)?.[0]
      const sameStart = !r.startDate || (!!twin && year(twin.startDate) === year(r.startDate))
      return { company: r.company, role: r.role as string, location: r.location, startDate: r.startDate ?? twin?.startDate ?? "", endDate: r.endDate ?? (sameStart ? twin?.endDate : undefined), bullets: r.bullets }
    })
    return { ...cv, experience, skills: skillsLookBroken(cv) && extras.skillGroups.length ? extras.skillGroups.map((g) => ({ category: g.category, items: g.items })) : cv.skills, projects: cv.projects.length ? cv.projects : extras.projects.map((p) => ({ name: p.name, description: p.description, technologies: [] as string[], bullets: [] as string[] })) }
  }
  const experience = cv.experience.map((e) => {
    if (e.bullets.some((b) => cleanBullet(b))) return e
    const hits = companyHits(extras, e.company)
    const pick = hits.find((h) => roleMatches(h, e.role)) ?? (hits.length === 1 && !hits[0].role ? hits[0] : undefined)
    return pick?.bullets.length ? { ...e, bullets: pick.bullets } : e
  })
  const skills = skillsLookBroken(cv) && extras.skillGroups.length ? extras.skillGroups.map((g) => ({ category: g.category, items: g.items })) : cv.skills
  const projects = cv.projects.length ? cv.projects : extras.projects.map((p) => ({ name: p.name, description: p.description, technologies: [] as string[], bullets: [] as string[] }))
  return { ...cv, experience, skills, projects }
}

export function buildAtsDoc(original: CV, opts: { lang?: AtsLang; summary?: string; extras?: AtsExtras } = {}): AtsDoc {
  const cv = withExtras(original, opts.extras)
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
  if (exp.kept || edu.kept) warn("order-kept", "Alguna fecha del CV no se entiende (está escrita pero no se puede leer como mes y año): se respetó el orden del CV original.")

  let summaryRaw = (cv.summary?.trim() ? cv.summary : opts.summary)?.trim()
  const summarySource: AtsDoc["summarySource"] = cv.summary?.trim() ? "cv" : opts.summary?.trim() ? "ia" : "none"
  if (summaryRaw && summarySource === "cv") {
    const t = trimSummary(oneLine(summaryRaw))
    if (t.cut) warn("summary-cut", "Tu resumen era más largo que lo recomendado para ATS (2–4 líneas): se dejaron sus primeras frases completas, tal cual.")
    summaryRaw = t.text
  }
  const summaryText = summaryRaw

  // Lectura profunda (A5): lo que `withExtras` ya puso en el CV, más lo que el CV no tiene dónde guardar (nota de empresa, certificaciones, voluntariado).
  const extras = opts.extras
  const usedNotes = new Set<string>()
  const experienceBlocks = exp.items.map((e) => {
    const hits = companyHits(extras, e.company).filter((h) => h.companyNote && !usedNotes.has(comparable(h.companyNote)))
    const note = (hits.find((h) => roleMatches(h, e.role)) ?? hits[0])?.companyNote
    if (note) usedNotes.add(comparable(note))
    return {
      kind: "entry" as const,
      head: withDate(`${title(e.role)} — ${clean([e.company, e.location]).join(", ")}`, range(e.startDate, e.endDate)),
      lines: note ? [oneLine(note)] : [],
      bullets: e.bullets.map(cleanBullet).filter(Boolean),
    }
  })
  const eduText = comparable(cv.education.map((e) => `${e.institution} ${e.degree ?? ""} ${e.field ?? ""}`).join(" "))
  // Una certificación que ya figura en Educación (casi todas sus palabras) no se repite.
  const inEducation = (c: string) => {
    const w = comparable(c).split(" ").filter((x) => x.length > 2 && !/^\d+$/.test(x))
    return w.length > 0 && w.filter((x) => eduText.includes(x)).length / w.length >= 0.8
  }
  const certs = dedupe(clean((extras?.certifications ?? []).filter((c) => !inEducation(c))))
  const volunteering = dedupe(clean(extras?.volunteering ?? []))
  const filled = cv !== original || usedNotes.size > 0 || certs.length > 0 || volunteering.length > 0
  if (filled) warn("extras-used", "Se completó con contenido de tu CV original que el análisis general no había recogido (viñetas, descripciones de empresa, certificaciones, habilidades o voluntariado).")

  const bodies: Record<AtsSectionKey, AtsBlock[]> = {
    summary: summaryText ? [{ kind: "para", text: oneLine(summaryText) }] : [],
    experience: experienceBlocks,
    education: edu.items.map((e) => {
      const title = clean([e.degree, e.field]).join(", ")
      return {
        kind: "entry" as const,
        head: withDate(title ? `${title} — ${oneLine(e.institution)}` : oneLine(e.institution), range(e.startDate, e.endDate)),
        lines: [],
        bullets: e.details.map(cleanBullet).filter(Boolean),
      }
    }),
    certifications: certs.map((c) => ({ kind: "para" as const, text: c })),
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
    volunteering: volunteering.map((v) => ({ kind: "para" as const, text: v })),
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
