import { totalYears } from "@/lib/cv/dates"
import { fold } from "@/lib/keywords/normalize"
import { cvCorpus, verifyNoInvention } from "@/lib/rewrite/verify"
import type { CV } from "@/lib/schemas/cv"
import { formatDate, MONTH_NAMES, parseParts, sortKey } from "./dates"
import { extractFile, type Extraction, type Line } from "./extract"
import { ATS_HEADINGS, ATS_LABELS, type AtsLang } from "./headings"
import { detectLang } from "./lang"
import { cleanBullet, spellTitle } from "./model"
import { ATS_RULES, WEIGHT_POINTS, type RuleDef } from "./rules"

/**
 * Verificador del CV ATS (Fase A3). Lee el ARCHIVO generado (PDF o Word) y aplica las reglas de docs/CONOCIMIENTO-ATS.md. Cada regla da
 * «cumple», «no cumple» o «no aplica» (p. ej. enlaces cuando el CV no trae ninguno); las que no aplican no suman ni restan.
 * Porcentaje = puntos de reglas cumplidas ÷ puntos de reglas aplicables (pesos C=5, A=3, M=2, B=1). Si falla una regla crítica, el
 * máximo mostrado es 69 %. Mide el formato según guías públicas; NO garantiza que un ATS concreto lo acepte.
 */
export type Status = "pass" | "fail" | "na"
export type RuleResult = RuleDef & { status: Status; detail: string; evidence?: string[] }
export type Label = "listo" | "casi" | "cambios" | "esencial"
export type AtsReport = {
  percent: number
  /** porcentaje antes de aplicar el tope por reglas críticas */
  rawPercent: number
  capped: boolean
  label: Label
  labelText: string
  earned: number
  possible: number
  rules: RuleResult[]
  counts: { pass: number; fail: number; na: number }
  file: { format: "pdf" | "docx"; fileName: string; bytes: number; pages: number | null; fonts: string[]; bodySize: number | null }
  disclaimer: string
}

export type Score = Pick<AtsReport, "percent" | "rawPercent" | "capped" | "label" | "labelText" | "earned" | "possible">

/** Porcentaje = puntos cumplidos ÷ puntos aplicables; nunca 100 % si algo falla; con una regla crítica fallida, máximo 69 %. */
export function scoreRules(rules: Pick<RuleResult, "weight" | "status">[]): Score {
  const applicable = rules.filter((r) => r.status !== "na")
  const possible = applicable.reduce((s, r) => s + WEIGHT_POINTS[r.weight], 0)
  const earned = applicable.filter((r) => r.status === "pass").reduce((s, r) => s + WEIGHT_POINTS[r.weight], 0)
  const allPass = applicable.every((r) => r.status === "pass")
  const rawPercent = possible ? (allPass ? 100 : Math.min(99, Math.round((earned / possible) * 100))) : 0
  const criticalFail = rules.some((r) => r.weight === "C" && r.status === "fail")
  const percent = criticalFail ? Math.min(rawPercent, CAP_WITH_CRITICAL_FAIL) : rawPercent
  const label: Label = criticalFail ? "esencial" : percent >= 90 ? "listo" : percent >= 75 ? "casi" : "cambios"
  return { percent, rawPercent, capped: criticalFail && rawPercent > CAP_WITH_CRITICAL_FAIL, label, labelText: LABEL_TEXT[label], earned, possible }
}

export const DISCLAIMER = "Mide el formato según guías públicas de empleo; no garantiza que un ATS concreto lo acepte."
export const CAP_WITH_CRITICAL_FAIL = 69
export const LABEL_TEXT: Record<Label, string> = { listo: "Listo para ATS", casi: "Casi: corrige estos puntos", cambios: "Necesita cambios", esencial: "No cumple lo esencial" }

type Outcome = { status: Status; detail: string; evidence?: string[] }
const pass = (detail = ""): Outcome => ({ status: "pass", detail })
const fail = (detail: string, evidence?: string[]): Outcome => ({ status: "fail", detail, evidence })
const na = (detail: string): Outcome => ({ status: "na", detail })

// ---- títulos de sección aceptados (nombres que usan las fuentes; docs/CONOCIMIENTO-ATS.md §4) ----
type Key = "summary" | "experience" | "education" | "skills" | "languages" | "projects" | "certifications"
const SYN: Record<AtsLang, Record<Key, string[]>> = {
  es: { summary: ["resumen profesional", "resumen", "perfil profesional"], experience: ["experiencia laboral", "experiencia profesional", "experiencia"], education: ["educacion", "formacion academica", "formacion"], skills: ["habilidades", "competencias"], languages: ["idiomas"], projects: ["proyectos"], certifications: ["certificaciones"] },
  en: { summary: ["professional summary", "summary"], experience: ["work experience", "professional experience", "experience"], education: ["education"], skills: ["skills", "core skills"], languages: ["languages"], projects: ["projects"], certifications: ["certifications"] },
}
function headingInfo(title: string): { key: Key; lang: AtsLang } | null {
  const t = fold(title).trim()
  for (const lang of ["es", "en"] as const) for (const [key, names] of Object.entries(SYN[lang]) as [Key, string[]][]) if (names.includes(t)) return { key, lang }
  return null
}
const RANK: Record<Key, number> = { summary: 0, experience: 1, education: 2, skills: 2, languages: 3, projects: 3, certifications: 3 }

const BULLET_START = /^[•·▪▫■□◦‣⁃●○◆◇➢➤►▶*\-–—]\s/
const isBullet = (l: Line) => (l.bullet != null ? true : BULLET_START.test(l.text))
const stripBullet = (t: string) => t.replace(BULLET_START, "").trim()
const squash = (s: string) => fold(s).replace(/\s+/g, "")
const words = (s: string) => fold(s).match(/[\p{L}\p{N}]+/gu) ?? []

const MONTH_ALT = [...MONTH_NAMES.es, ...MONTH_NAMES.en].map(fold).join("|")
const MONTHS_RE = new RegExp(`\\b(?:${MONTH_ALT})\\s+(?:19|20)\\d{2}\\b`, "gi")
const NUMERIC_RE = /\b\d{1,2}\/(?:19|20)\d{2}\b/g

const ES_VERBS = new Set("reduje hice conduje traduje produje puse tuve estuve fui dije lidero gestiono analizo diseno planifico coordino administro implemento desarrollo creo ejecuto superviso dirijo mejoro optimizo automatizo colaboro apoyo elabore elaboro realice realizo participe participo ayude ayudo cree genere logre aumente incremente reduci redujo gestione lidere dirigi diseñe".split(" "))
const EN_VERBS = new Set("led built ran wrote drove made grew won taught spoke sold set managed lead build develop design create manage analyze implement improve reduce increase deliver coordinate support optimize automate launch plan run write drive make grow win teach speak sell oversee direct conduct execute produce".split(" "))
const startsWithVerb = (text: string, lang: AtsLang): boolean => {
  const w = text.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^\p{L}]/gu, "") ?? ""
  if (!w) return false
  if (lang === "es") return ES_VERBS.has(fold(w)) || /(é|í|ó)$/.test(w) || /(aste|iste|aron|ieron)$/.test(w)
  return EN_VERBS.has(w) || /ed$/.test(w)
}

const BUZZ = ["apasionado", "apasionada", "proactivo", "proactiva", "orientado a resultados", "orientada a resultados", "dinamico", "dinamica", "persona creativa", "team player", "results-driven", "results driven", "hard-working", "hardworking", "go-getter", "detail-oriented", "self-motivated", "passionate"]
const STOP = new Set("para como con los las del por una unos unas que sus este esta entre desde sobre the and for with that this from your".split(" "))
const SENSITIVE = /(fecha de nacimiento|date of birth|estado civil|marital status|nacionalidad|nationality|c[eé]dula|documento de identidad|pasaporte|passport)/i
const ALLOWED_FONTS = ["arial", "calibri", "timesnewroman", "helvetica", "liberationsans", "liberationserif", "arimo", "tinos"]

export type VerifyInput = { file: Buffer; fileName: string; cv: CV; /** texto canónico esperado (`atsToText`), para comprobar que no se perdió nada ni se desordenó */ expectedText?: string }

export async function verifyAtsFile(input: VerifyInput): Promise<AtsReport> {
  const ex = await extractFile(input.file)
  return verifyExtraction(ex, input)
}

export function verifyExtraction(ex: Extraction, input: VerifyInput): AtsReport {
  const { cv, fileName, expectedText } = input
  const lines = ex.lines
  const headings = lines.filter((l) => l.heading)
  const firstHeadingAt = lines.findIndex((l) => l.heading)
  const top = firstHeadingAt < 0 ? lines : lines.slice(0, firstHeadingAt)
  type Sec = { key: Key | null; title: string; lines: Line[] }
  const secs: Sec[] = []
  for (const l of lines) {
    if (l.heading) secs.push({ key: headingInfo(l.text)?.key ?? null, title: l.text, lines: [] })
    else if (secs.length) secs[secs.length - 1].lines.push(l)
  }
  const sec = (k: Key) => secs.find((s) => s.key === k)
  const docLang: AtsLang | null = (() => {
    const hs = headings.map((h) => headingInfo(h.text)?.lang).filter(Boolean)
    const es = hs.filter((x) => x === "es").length
    const en = hs.filter((x) => x === "en").length
    return es === en ? null : es > en ? "es" : "en"
  })()
  const lang: AtsLang = docLang ?? "es"
  const fullText = ex.text
  const folded = fold(fullText).replace(/\s+/g, " ")
  const bulletsOf = (s?: Sec) => (s?.lines ?? []).filter(isBullet)
  const bodyLines = lines.filter((l) => !l.heading)

  const R: Record<string, () => Outcome> = {}

  // ---------- archivo ----------
  R["ATS-F1"] = () => {
    if (expectedText) {
      const exp = new Set(words(expectedText))
      const got = new Set(words(fullText))
      const found = [...exp].filter((w) => got.has(w)).length
      const cov = exp.size ? found / exp.size : 0
      return cov >= 0.95 ? pass(`Se recuperó el ${Math.round(cov * 100)} % de las palabras.`) : fail(`Solo se recuperó el ${Math.round(cov * 100)} % de las palabras esperadas.`)
    }
    return fullText.length >= 200 ? pass(`${fullText.length} caracteres de texto.`) : fail(`Solo ${fullText.length} caracteres de texto seleccionable.`)
  }
  R["ATS-F2"] = () => {
    const ext = fileName.split(".").pop()?.toLowerCase()
    return ext === ex.format ? pass(ex.format === "pdf" ? "PDF con texto." : "Word (.docx).") : fail(`La extensión «.${ext}» no coincide con el contenido (${ex.format}).`)
  }
  R["ATS-F3"] = () => {
    if (ex.columns > 1) return fail(`El documento define ${ex.columns} columnas.`)
    if (ex.wideGapLines > 0) return fail(`${ex.wideGapLines} línea(s) con huecos grandes: parece haber columnas.`)
    if (expectedText) {
      const hay = squash(fullText)
      let at = 0
      for (const l of expectedText.split("\n").filter((x) => x.trim())) {
        const i = hay.indexOf(squash(l), at)
        if (i < 0) return fail("El orden de lectura no coincide con el del documento.", [l.slice(0, 80)])
        at = i
      }
    }
    return pass("Una columna; el texto sale en el orden del documento.")
  }
  R["ATS-F4"] = () => {
    const bad = [ex.hasTables && "tablas", ex.hasTextBoxes && "cuadros de texto", ex.imageCount > 0 && `${ex.imageCount} imagen(es)`, ex.oddAnnotations > 0 && "anotaciones o formularios"].filter(Boolean) as string[]
    return bad.length ? fail(`Contiene ${bad.join(", ")}.`) : pass("Sin tablas, cuadros de texto, imágenes ni anotaciones.")
  }
  R["ATS-F5"] = () => {
    if (ex.headerFooterText.length) return fail("Hay texto en el encabezado o pie de página.", ex.headerFooterText.slice(0, 3))
    if (ex.format === "pdf") {
      const bad = lines.filter((l) => l.yTop != null && /@|\+?\d[\d\s]{6,}/.test(l.text) && (l.yTop < 36 || l.yTop > 841.9 - 36))
      if (bad.length) return fail("Datos de contacto en la franja del encabezado o del pie.", bad.map((b) => b.text.slice(0, 60)))
    }
    return pass("El contacto está en el cuerpo.")
  }
  R["ATS-F6"] = () => {
    const notes: string[] = []
    if (ex.pages != null && ex.pages > 2) return fail(`Tiene ${ex.pages} páginas (máximo 2).`)
    if (ex.minSize != null && ex.minSize < 9.95) return fail(`Hay texto de ${ex.minSize} pt: parece encogido para caber.`)
    if (ex.margins?.left != null && ex.margins.left < 1.25) return fail("Márgenes reducidos para caber.")
    if (ex.pages == null) notes.push("el número de páginas de un Word no se puede medir")
    return pass(ex.pages != null ? `${ex.pages} página(s).` : `Sin señales de encogimiento (${notes.join("; ")}).`)
  }
  R["ATS-F7"] = () => (/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*\.(?:pdf|docx)$/.test(fileName) && fileName.replace(/\.\w+$/, "").split("-").length >= 2 ? pass(fileName) : fail(`«${fileName}» no sigue el patrón Nombre-Apellido-Cargo.`))
  R["ATS-F8"] = () => (ex.bytes < 2.5 * 1024 * 1024 ? pass(`${(ex.bytes / 1024).toFixed(0)} KB.`) : fail(`Pesa ${(ex.bytes / 1024 / 1024).toFixed(1)} MB.`))

  // ---------- tipografía ----------
  R["ATS-T1"] = () => {
    if (!ex.fonts.length) return fail("No se pudo leer la fuente del archivo.")
    const bad = ex.fonts.filter((f) => !ALLOWED_FONTS.includes(f))
    if (bad.length) return fail(`Fuente(s) no estándar: ${bad.join(", ")}.`)
    return ex.fonts.length > 1 ? fail(`Más de una familia de fuente: ${ex.fonts.join(", ")}.`) : pass(`Fuente: ${ex.fonts[0]}.`)
  }
  R["ATS-T2"] = () => {
    if (ex.bodySize == null) return fail("No se pudo leer el tamaño del texto.")
    if (ex.bodySize < 10 || ex.bodySize > 12) return fail(`El cuerpo es de ${ex.bodySize} pt (debe estar entre 10 y 12).`)
    return ex.minSize != null && ex.minSize < 9.95 ? fail(`Hay texto de ${ex.minSize} pt (mínimo 10).`) : pass(`Cuerpo de ${ex.bodySize} pt.`)
  }
  R["ATS-T3"] = () => {
    const m = ex.margins
    if (!m) return fail("No se pudieron medir los márgenes.")
    const probs: string[] = []
    const f = (n: number | null) => (n == null ? "?" : n.toFixed(2))
    if (m.left != null && (m.left < 1.2 || m.left > 2.6)) probs.push(`izquierdo ${f(m.left)} cm`)
    if (m.top != null && (m.top < 1.2 || m.top > 2.9)) probs.push(`superior ${f(m.top)} cm`)
    if (m.right != null && m.right < 1.2) probs.push(`derecho ${f(m.right)} cm`)
    if (m.bottom != null && m.bottom < 1.2) probs.push(`inferior ${f(m.bottom)} cm`)
    return probs.length ? fail(`Márgenes fuera de 1,25–2,5 cm: ${probs.join(", ")}.`) : pass(`Izquierdo ${f(m.left)} cm, superior ${f(m.top)} cm.`)
  }
  R["ATS-T4"] = () => {
    const ok = ex.format === "pdf" ? ["#000000", "#ffffff"] : ["000000", "auto", "ffffff", "fill:auto", "fill:ffffff"]
    const bad = ex.colors.filter((c) => !ok.includes(c))
    return bad.length ? fail(`Colores distintos de negro sobre blanco: ${bad.slice(0, 4).join(", ")}.`) : pass("Texto negro sobre blanco.")
  }
  R["ATS-T5"] = () => {
    if (!headings.length) return na("No se encontraron títulos de sección.")
    if (ex.letterSpacing) return fail("Hay espaciado entre letras.")
    const bad = headings.filter((h) => h.bold === false && h.text !== h.text.toUpperCase())
    return bad.length ? fail("Títulos sin negrita ni mayúsculas.", bad.map((b) => b.text)) : pass(ex.boldKnown ? "Títulos en negrita." : "Títulos sin espaciado entre letras (la negrita no se pudo leer).")
  }
  R["ATS-T6"] = () => {
    if (ex.format === "docx") return ex.headingSpaceBefore == null ? na("Sin estilo de título.") : ex.headingSpaceBefore >= 6 ? pass(`${ex.headingSpaceBefore} pt antes de cada título.`) : fail(`Solo ${ex.headingSpaceBefore} pt antes de cada título.`)
    const diffs: number[] = []
    for (let i = 1; i < lines.length; i++) if (lines[i].page === lines[i - 1].page && lines[i].yTop != null && lines[i - 1].yTop != null) diffs.push((lines[i].yTop as number) - (lines[i - 1].yTop as number))
    const pitch = [...diffs].sort((a, b) => a - b)[Math.floor(diffs.length / 2)] || 0
    const tight = lines.flatMap((l, i) => (l.heading && i > 0 && lines[i - 1].page === l.page && (l.yTop as number) - (lines[i - 1].yTop as number) < pitch * 1.2 ? [l.text] : []))
    return !pitch ? na("Muy poco texto para medirlo.") : tight.length ? fail("Títulos pegados a la sección anterior.", tight) : pass("Hay espacio antes de cada título.")
  }

  // ---------- secciones ----------
  R["ATS-S1"] = () => {
    if (!headings.length) return fail("No se encontraron títulos de sección.")
    const bad = headings.filter((h) => !headingInfo(h.text))
    return bad.length ? fail("Títulos no convencionales.", bad.map((b) => b.text)) : pass(`${headings.length} títulos estándar.`)
  }
  R["ATS-S2"] = () => {
    const need: Key[] = [cv.experience.length && "experience", cv.education.length && "education", cv.skills.some((g) => g.items.length) && "skills"].filter(Boolean) as Key[]
    if (!need.length) return na("El CV original no trae experiencia, educación ni habilidades.")
    const missing = need.filter((k) => !sec(k))
    return missing.length ? fail(`Falta: ${missing.map((k) => ATS_HEADINGS[lang][k as keyof (typeof ATS_HEADINGS)[AtsLang]]).join(", ")}.`) : pass()
  }
  R["ATS-S3"] = () => {
    const s = sec("summary")
    if (!s) return na("El documento no tiene resumen.")
    const text = s.lines.map((l) => l.text).join(" ")
    const n = (text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? []).filter((x) => x.trim()).length
    if (n < 2 || n > 4) return fail(`El resumen tiene ${n} frase(s) (deben ser 2–4).`)
    return pass(text.length > 400 ? `${n} frases; es largo (${text.length} caracteres, ~4 líneas = 400): conviene acortarlo.` : `${n} frases.`)
  }
  R["ATS-S4"] = () => {
    const s = sec("experience")
    const heads = (s?.lines ?? []).filter((l) => !isBullet(l))
    const keys = heads.map((h) => {
      const range = h.text.split(" | ").pop() ?? ""
      const [a, b] = range.split(" – ")
      const st = sortKey(a, "start")
      return { end: sortKey(b ?? a, "end") ?? st, start: st }
    })
    if (keys.length < 2) return na("Menos de dos puestos.")
    if (keys.some((k) => k.end == null)) return na("Alguna fecha no se entiende; no se puede comprobar el orden.")
    for (let i = 1; i < keys.length; i++) if ((keys[i].end as number) > (keys[i - 1].end as number)) return fail("Hay un puesto más reciente después de uno más antiguo.", [heads[i - 1].text.slice(0, 80), heads[i].text.slice(0, 80)])
    return pass("Del más reciente al más antiguo.")
  }
  R["ATS-S5"] = () => {
    const ranks = secs.filter((s) => s.key).map((s) => RANK[s.key as Key])
    return ranks.every((r, i) => i === 0 || r >= ranks[i - 1]) ? pass() : fail("Orden distinto al recomendado.", secs.map((s) => s.title))
  }
  R["ATS-S6"] = () => {
    const seen = new Set<string>()
    const dup = secs.filter((s) => (seen.has(fold(s.title)) ? true : (seen.add(fold(s.title)), false)))
    return dup.length ? fail("Títulos repetidos.", dup.map((d) => d.title)) : pass()
  }

  // ---------- contacto ----------
  R["ATS-K1"] = () => (lines[0] && fold(lines[0].text) === fold(cv.header.fullName) ? pass(lines[0].text) : fail("La primera línea no es el nombre completo.", [lines[0]?.text.slice(0, 80) ?? ""]))
  R["ATS-K2"] = () => {
    const want = { correo: cv.header.email, teléfono: cv.header.phone, ciudad: cv.header.location }
    const have = Object.entries(want).filter(([, v]) => v?.trim())
    if (!have.length) return na("El CV no trae correo, teléfono ni ciudad.")
    const anchor = (cv.header.email?.trim() || have[0][1]) as string
    const line = top.slice(1, 4).find((l) => (have.length < 2 || l.text.includes("|")) && fold(l.text).includes(fold(anchor)))
    if (!line) return fail(have.length < 2 ? "No hay una línea de contacto entre las primeras líneas." : "No hay una línea de contacto con «|» entre las primeras líneas.")
    const digits = (s: string) => s.replace(/\D/g, "")
    const missing = have.filter(([k, v]) => (k === "teléfono" ? !digits(line.text).includes(digits(v as string)) : !fold(line.text).includes(fold(v as string)))).map(([k]) => k)
    return missing.length ? fail(`Falta en la línea de contacto: ${missing.join(", ")}.`, [line.text]) : pass()
  }
  R["ATS-K3"] = () => {
    if (!cv.header.email?.trim()) return na("El CV no trae correo.")
    const emails = fullText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []
    return emails.some((e) => fold(e) === fold(cv.header.email as string)) ? pass(cv.header.email) : fail("El correo no aparece como texto en el archivo.")
  }
  R["ATS-K4"] = () => {
    const urls = cv.header.links.map((l) => l.url.trim()).filter(Boolean)
    if (!urls.length) return na("El CV no trae enlaces.")
    const missing = urls.filter((u) => !folded.includes(fold(u)))
    return missing.length ? fail("Faltan enlaces como texto.", missing) : pass(`${urls.length} enlace(s).`)
  }
  R["ATS-K5"] = () => {
    if (ex.imageCount > 0) return fail("El archivo contiene imágenes (¿foto?).")
    const m = fullText.match(SENSITIVE)
    return m ? fail(`Dato personal sensible: «${m[0]}».`) : pass()
  }

  // ---------- experiencia ----------
  const expHeads = (sec("experience")?.lines ?? []).filter((l) => !isBullet(l))
  R["ATS-E1"] = () => {
    if (!expHeads.length) return na("No hay puestos.")
    const noShape = expHeads.filter((h) => !/^.+ — .+/.test(h.text))
    const withYear = expHeads.filter((h) => /(?:19|20)\d{2}/.test(h.text)).length
    const wantYear = cv.experience.filter((e) => /\d{4}/.test(e.startDate)).length
    if (noShape.length) return fail("Puestos que no siguen «Cargo — Empresa | fechas».", noShape.map((h) => h.text.slice(0, 80)))
    return withYear < wantYear ? fail(`Faltan fechas en ${wantYear - withYear} puesto(s).`) : pass(`${expHeads.length} puesto(s).`)
  }
  R["ATS-E2"] = () => {
    const names = fullText.match(MONTHS_RE) ?? []
    const nums = fullText.match(NUMERIC_RE) ?? []
    if (!names.length && !nums.length) return na("Sin fechas con mes.")
    return names.length && nums.length ? fail("Mezcla «Mes Año» con «MM/AAAA».", [names[0] ?? "", nums[0] ?? ""]) : pass(names.length ? "Formato «Mes Año»." : "Formato «MM/AAAA».")
  }
  R["ATS-E3"] = () => {
    const dated = [...cv.experience.flatMap((e) => [e.startDate, e.endDate]), ...cv.education.flatMap((e) => [e.startDate, e.endDate])].filter((d): d is string => !!d?.trim())
    if (!dated.length) return na("Sin fechas.")
    const hyphen = fullText.match(/(?:\b(?:19|20)\d{2}|Presente|Present)\s+-\s+(?=(?:[A-Za-zÀ-ÿ]+\s+)?(?:19|20)\d{2}|Presente|Present)/)
    if (hyphen) return fail("Hay rangos con guion corto («-»): usa «–».", [hyphen[0]])
    const lost = dated.filter((d) => parseParts(d)?.month != null).filter((d) => !folded.includes(fold(formatDate(d, lang).text)))
    return lost.length ? fail("Fechas con mes en el CV que aparecen sin mes o cambiadas.", lost.slice(0, 3)) : pass()
  }
  const allBullets = bodyLines.filter(isBullet)
  R["ATS-E4"] = () => {
    if (!allBullets.length) return na("No hay viñetas.")
    const chars = allBullets.map((l) => (l.bullet != null ? l.bullet || "•" : l.text[0]))
    const bad = chars.filter((c) => c !== "•" && c !== "–")
    return bad.length ? fail(`Viñetas no estándar: ${[...new Set(bad)].join(" ")}.`) : pass()
  }
  R["ATS-E5"] = () => {
    const bs = bulletsOf(sec("experience")).map((l) => stripBullet(l.text))
    if (!bs.length) return na("No hay viñetas de experiencia.")
    const verb = bs.filter((b) => startsWithVerb(b, lang)).length
    const long = bs.filter((b) => b.split(/\s+/).length > 25)
    const okVerb = verb / bs.length >= 0.7
    const okLong = long.length / bs.length <= 0.1
    if (okVerb && okLong) return pass(`${verb}/${bs.length} empiezan con verbo; ninguna pasa de 25 palabras.`)
    return fail([!okVerb && `Solo ${verb} de ${bs.length} viñetas empiezan con un verbo de acción.`, !okLong && `${long.length} de ${bs.length} pasan de 25 palabras.`].filter(Boolean).join(" "), [...(!okVerb ? bs.filter((b) => !startsWithVerb(b, lang)).slice(0, 2) : []), ...long.slice(0, 1)].map((b) => b.slice(0, 80)))
  }
  R["ATS-E6"] = () => {
    const s = sec("experience")
    if (!s || !expHeads.length) return na("No hay puestos.")
    const counts: number[] = []
    for (const l of s.lines) {
      if (!isBullet(l)) counts.push(0)
      else if (counts.length) counts[counts.length - 1]++
    }
    const bad = counts.filter((c) => c < 1 || c > 6)
    return bad.length ? fail(`${bad.length} puesto(s) con ${bad.some((c) => c < 1) ? "0" : "más de 6"} viñetas.`) : pass()
  }
  R["ATS-E7"] = () => {
    const s = sec("education")
    const heads = (s?.lines ?? []).filter((l) => !isBullet(l))
    if (!heads.length) return na("No hay educación.")
    const wantDash = cv.education.filter((e) => !!(e.degree?.trim() || e.field?.trim())).length
    const dashes = heads.filter((h) => h.text.includes(" — ")).length
    const multi = heads.filter((h) => h.text.split(" | ").length > 2)
    return dashes < wantDash ? fail("Estudios sin el formato «Título — Institución».") : multi.length ? fail("Más de un separador de fecha.", multi.map((m) => m.text)) : pass()
  }
  R["ATS-E8"] = () => {
    const s = sec("skills")
    if (!s?.lines.length) return na("No hay habilidades.")
    const bad = s.lines.filter((l) => /\|/.test(l.text) || /\b\d{1,3}\s?%/.test(l.text) || /[★☆●○▮▯■□]{2,}/.test(l.text) || /\b(nivel|level|beginner|intermediate|advanced|principiante)\b/i.test(l.text))
    if (bad.length) return fail("Habilidades con barras, porcentajes, niveles o «|».", bad.map((b) => b.text.slice(0, 80)))
    const big = s.lines.filter((l) => l.text.split(",").length > 15)
    return pass(big.length ? `Aviso: un grupo tiene más de 15 habilidades (${big.length}).` : "")
  }
  R["ATS-E9"] = () => {
    const acr = [...new Set(fullText.match(/\b[A-Z]{3,6}\b/g) ?? [])]
    const orig = cvCorpus({ ...cv, sectionOrder: undefined })
    const withFull = acr.filter((a) => new RegExp(`[A-Za-zÀ-ÿ]+[^()\\n]{0,60}\\(${a}\\)`).test(orig))
    if (!withFull.length) return na("El CV original no trae ninguna sigla con su forma completa (no se puede inventar).")
    const lost = withFull.filter((a) => !new RegExp(`\\(${a}\\)`).test(fullText))
    return lost.length ? fail("Siglas que perdieron su forma completa.", lost) : pass()
  }
  R["ATS-E10"] = () => {
    const targets = [...top.slice(1, 3).filter((l) => !l.text.includes("|") && !l.text.includes("@")), ...expHeads.map((h) => ({ ...h, text: h.text.split(" — ")[0] }))]
    const bad = targets.filter((l) => spellTitle(l.text).changed.length)
    return bad.length ? fail("Cargos con abreviaturas.", bad.map((b) => b.text)) : pass()
  }

  // ---------- contenido ----------
  R["ATS-I1"] = () => {
    const extras = [...MONTH_NAMES.es, ...MONTH_NAMES.en, ATS_LABELS.es.present, ATS_LABELS.en.present, ATS_LABELS.es.technologies, ATS_LABELS.en.technologies, "Senior", "Junior", "Semi"].join(" ")
    const years = totalYears(cv.experience.map((e) => ({ start: e.startDate, end: e.endDate })))
    const guard = `${cvCorpus({ ...cv, sectionOrder: undefined })}\n${extras}\n${years != null ? Math.floor(years) : ""}`
    const text = bodyLines.map((l) => stripBullet(l.text)).join("\n")
    const v = verifyNoInvention(guard, text)
    return v.ok ? pass("Todo el contenido se rastrea al CV original.") : fail("Contenido que no está en el CV original.", v.violations.slice(0, 5).map((x) => x.value))
  }
  R["ATS-I2"] = () => {
    const miss: string[] = []
    const has = (s: string) => squash(folded).includes(squash(s))
    for (const e of cv.experience) {
      if (!has(e.company)) miss.push(`empresa «${e.company}»`)
      if (!has(spellTitle(e.role).text)) miss.push(`cargo «${e.role}»`)
      for (const b of e.bullets.map(cleanBullet).filter(Boolean)) if (!has(b)) miss.push(`viñeta «${b.slice(0, 40)}…»`)
    }
    for (const e of cv.education) if (!has(e.institution)) miss.push(`institución «${e.institution}»`)
    for (const s of new Set(cv.skills.flatMap((g) => g.items).map((i) => fold(i.trim())))) if (!has(s)) miss.push(`habilidad «${s}»`)
    return miss.length ? fail(`Faltan ${miss.length} elemento(s) del CV original.`, miss.slice(0, 5)) : pass("Puestos, estudios, viñetas y habilidades están.")
  }
  R["ATS-I3"] = () => {
    const text = [...(sec("summary")?.lines ?? []), ...(sec("skills")?.lines ?? [])].map((l) => l.text).join(" ")
    const freq = new Map<string, number>()
    for (const w of words(text)) if (w.length >= 4 && !STOP.has(w)) freq.set(w, (freq.get(w) ?? 0) + 1)
    const stuffed = [...freq].filter(([, n]) => n >= 5).map(([w, n]) => `${w} ×${n}`)
    return stuffed.length ? fail("Palabras repetidas en exceso.", stuffed) : pass()
  }
  R["ATS-I4"] = () => {
    const text = fold([...(sec("summary")?.lines ?? []), ...bulletsOf(sec("experience"))].map((l) => l.text).join(" "))
    const found = BUZZ.filter((b) => text.includes(fold(b)))
    return found.length ? fail("Frases vagas de moda.", found) : pass()
  }
  R["ATS-I5"] = () => {
    const d = detectLang(cv)
    if (d.detected === "otro") return na("No se pudo identificar el idioma del CV original.")
    if (!docLang) return fail("No se pudo identificar el idioma de los títulos.")
    return docLang === d.lang ? pass(docLang === "es" ? "Español." : "Inglés.") : fail(`El CV original está en ${d.lang === "es" ? "español" : "inglés"} pero los títulos están en ${docLang === "es" ? "español" : "inglés"}.`)
  }

  const rules: RuleResult[] = ATS_RULES.map((def) => {
    let o: Outcome
    try {
      o = R[def.id]()
    } catch {
      o = fail("No se pudo comprobar esta regla en el archivo.")
    }
    return { ...def, ...o }
  })

  const score = scoreRules(rules)
  return {
    ...score,
    rules,
    counts: { pass: rules.filter((r) => r.status === "pass").length, fail: rules.filter((r) => r.status === "fail").length, na: rules.filter((r) => r.status === "na").length },
    file: { format: ex.format, fileName, bytes: ex.bytes, pages: ex.pages, fonts: ex.fonts, bodySize: ex.bodySize },
    disclaimer: DISCLAIMER,
  }
}
