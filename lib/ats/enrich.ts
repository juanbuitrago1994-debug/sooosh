import { z } from "zod"
import { getProvider, type AIProvider } from "@/lib/ai"
import { isOpen } from "@/lib/cv/dates"
import { fold } from "@/lib/keywords/normalize"
import type { CV } from "@/lib/schemas/cv"

/**
 * Lectura profunda del CV original (Fase A5). El CV estructurado que guarda la app sale de un análisis general y, con PDF de diseño
 * (varias columnas, OCR), pierde cosas: viñetas, certificaciones, voluntariado, la descripción de cada empresa. Aquí un segundo pase con
 * la IA local relee el TEXTO ORIGINAL y devuelve fragmentos **copiados literalmente**; el código descarta todo fragmento que no aparezca
 * tal cual en ese texto. La IA solo localiza y agrupa; no redacta ni reescribe, así que no puede inventar.
 */
const text = (max: number) => z.string().trim().min(2).max(max)
export const extrasSchema = z.object({
  roles: z.array(z.object({ company: text(120), role: text(160).optional(), location: text(80).optional(), startDate: text(40).optional(), endDate: text(40).optional(), companyNote: text(400).optional() })).default([]),
  certifications: z.array(text(200)).default([]),
  volunteering: z.array(text(300)).default([]),
  skillGroups: z.array(z.object({ category: text(60).optional(), items: z.array(text(60)).min(1) })).default([]),
  projects: z.array(z.object({ name: text(120), description: text(500).optional() })).default([]),
})
export type RawExtras = z.infer<typeof extrasSchema>

export type AtsExtras = {
  /** por empresa (plegada): descripción de la empresa y viñetas que el análisis general no trajo */
  roles: { company: string; role?: string; location?: string; startDate?: string; endDate?: string; companyNote?: string; bullets: string[] }[]
  certifications: string[]
  volunteering: string[]
  skillGroups: { category?: string; items: string[] }[]
  projects: { name: string; description?: string }[]
}

/** Forma ya anclada (la que viaja entre cliente y servidor); se vuelve a comprobar contra el texto original con `regroundExtras`. */
export const atsExtrasSchema = z.object({
  roles: z.array(z.object({ company: text(120), role: text(160).optional(), location: text(80).optional(), startDate: text(40).optional(), endDate: text(40).optional(), companyNote: text(400).optional(), bullets: z.array(text(600)).default([]) })).default([]),
  certifications: z.array(text(200)).default([]),
  volunteering: z.array(text(300)).default([]),
  skillGroups: z.array(z.object({ category: text(60).optional(), items: z.array(text(60)).min(1) })).default([]),
  projects: z.array(z.object({ name: text(120), description: text(500).optional() })).default([]),
})

export const EMPTY_EXTRAS: AtsExtras = { roles: [], certifications: [], volunteering: [], skillGroups: [], projects: [] }
export const hasExtras = (e: AtsExtras) => !!(e.roles.length || e.certifications.length || e.volunteering.length || e.skillGroups.length || e.projects.length)

/** Texto comparable: sin tildes, mayúsculas ni signos; viñetas, saltos de línea y guiones de corte de línea no cuentan. */
export const comparable = (s: string) => fold(s).replace(/(\p{L})-\s*\n\s*(\p{L})/gu, "$1$2").replace(/[^\p{L}\p{N}]+/gu, " ").trim()

const MAX_SOURCE = 14_000

/** Líneas no vacías del texto original, numeradas desde 1: la IA señala rangos y el código copia el texto, así una viñeta no puede inventarse. */
export const sourceLines = (source: string): string[] => source.slice(0, MAX_SOURCE).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
const numbered = (source: string) => sourceLines(source).map((l, i) => `${i + 1}: ${l}`).join("\n")

const SYSTEM = `Eres un lector de CV. Recibes el TEXTO ORIGINAL de un CV con las líneas numeradas «N: texto» (puede venir de un PDF de diseño con columnas o de OCR, con símbolos de viñeta raros y líneas partidas) y un resumen de lo que ya se entendió. Tu trabajo es LOCALIZAR contenido que falta y devolverlo COPIADO TAL CUAL del texto original: nunca reescribas, resumas, traduzcas ni agregues palabras. Si algo no está en el texto, no lo incluyas.
Devuelve JSON con:
- "roles": TODOS los puestos de la experiencia laboral, en el orden del texto (si una empresa tuvo varios puestos o cuentas, un elemento por puesto). Por cada uno: "company" (solo el nombre de la empresa o cuenta, sin el cargo), "role" (el cargo, copiado), "location" (ciudad o país, solo si aparece junto al puesto), "startDate" y "endDate" (las fechas tal como se escriben, p. ej. "Ago 2025" y "Sep 2026"; "Actualidad" o "Presente" si sigue vigente; omítelas si no hay) y "companyNote" (la frase que describe a la empresa o al proyecto, si existe, copiada; NO es una viñeta). No incluyas las viñetas: se leen aparte.
- "certifications": cursos, certificaciones y diplomas cortos (una línea cada uno, copiada).
- "volunteering": voluntariado o trabajo comunitario (una entrada, copiada).
- "skillGroups": habilidades y herramientas agrupadas tal como el texto las agrupa ("category" copiada; "items" cada habilidad corta, copiada).
- "projects": proyectos propios o destacados con su "name" y "description" copiadas.
Omite una clave si no hay nada. Responde solo el JSON.`

/** Lo que el análisis general ya entendió, en pocas líneas, para que la IA sepa qué buscar. */
function digest(cv: CV): string {
  const lines = cv.experience.map((e) => `- ${e.role} @ ${e.company} (${e.bullets.length} viñetas entendidas)`)
  return `Puestos ya detectados:\n${lines.join("\n") || "- ninguno"}\nEstudios: ${cv.education.map((e) => e.institution).join("; ") || "ninguno"}`
}

const MARKER = /^[*+«»•·▪●○◦‣–—-]\s+\S/
const SECTION_STOP = /^(educaci[oó]n|formaci[oó]n|estudios|certificaciones|cursos|habilidades|skills|idiomas|languages|proyectos|projects|voluntariado|volunteer|education|certifications|referencias)\b/i

/**
 * Viñetas por bloque, sin IA: el bloque de un puesto va desde la línea donde aparecen su empresa y su cargo hasta el siguiente puesto (o el
 * siguiente título de sección). Una viñeta empieza en una línea con símbolo y sigue en las líneas siguientes que no lo tienen. Lo que hay
 * entre el título del puesto y la primera viñeta es la nota de la empresa. Todo es texto copiado del original.
 */
export function blocksFromSource(roles: { company: string; role?: string }[], lines: string[]): { bullets: string[]; note?: string }[] {
  const cmp = lines.map(comparable)
  let from = 0
  const anchors = roles.map((r) => {
    const c = comparable(r.company)
    const ro = comparable(r.role ?? "").split(" ").slice(0, 2).join(" ")
    let at = -1
    for (let i = from; i < lines.length && at < 0; i++) if (c && ` ${cmp[i]} `.includes(` ${c} `) && (!ro || cmp[i].includes(ro))) at = i
    for (let i = from; i < lines.length && at < 0; i++) if (c && ` ${cmp[i]} `.includes(` ${c} `)) at = i
    if (at >= 0) from = at + 1
    return at
  })
  return roles.map((_, k) => {
    const start = anchors[k]
    if (start < 0) return { bullets: [] }
    const next = anchors.slice(k + 1).find((a) => a > start)
    let end = next ?? lines.length
    for (let i = start + 1; i < end; i++) if (SECTION_STOP.test(lines[i])) { end = i; break }
    const bullets: string[] = []
    const preface: string[] = []
    for (const l of lines.slice(start + 1, end)) {
      if (MARKER.test(l)) bullets.push(l)
      else if (bullets.length) bullets[bullets.length - 1] += ` ${l}`
      else preface.push(l)
    }
    const note = preface.join(" ").replace(/\s+/g, " ").trim()
    return { bullets: bullets.map((b) => b.replace(/\s+/g, " ").trim()), note: note.length > 20 && note.length <= 400 ? note : undefined }
  })
}

/** Deja solo lo que el texto original contiene literalmente (comparación tolerante a mayúsculas, signos y saltos de línea). */
export function groundExtras(raw: RawExtras, source: string): AtsExtras {
  const lines = sourceLines(source)
  const hay = ` ${comparable(source)} `
  const ok = (s: string | undefined): s is string => !!s && s.trim().length > 1 && hay.includes(` ${comparable(s)} `)
  const hasOpenWord = /\b(actualidad|actual|presente|present|current|hoy|vigente|ongoing)\b/i.test(source)
  const okDate = (s: string | undefined): s is string => ok(s) || (!!s && isOpen(s) && hasOpenWord)
  const uniq = (xs: string[]) => {
    const seen = new Set<string>()
    return xs.filter((x) => (seen.has(comparable(x)) ? false : (seen.add(comparable(x)), true)))
  }
  const kept = raw.roles.filter((r) => ok(r.company))
  const blocks = blocksFromSource(kept, lines)
  return {
    roles: kept
      .map((r, i) => ({
        company: r.company.trim(),
        role: ok(r.role) ? r.role.trim() : undefined,
        location: ok(r.location) ? r.location.trim() : undefined,
        startDate: okDate(r.startDate) ? r.startDate.trim() : undefined,
        endDate: okDate(r.endDate) ? r.endDate.trim() : undefined,
        companyNote: ok(r.companyNote) ? r.companyNote.trim() : blocks[i].note,
        bullets: uniq(blocks[i].bullets),
      }))
      .filter((r) => ok(r.company) && (r.role || r.companyNote || r.bullets.length)),
    certifications: uniq(raw.certifications.filter(ok).map((c) => c.trim())),
    volunteering: uniq(raw.volunteering.filter(ok).map((c) => c.trim())),
    skillGroups: raw.skillGroups
      .map((g) => ({ category: ok(g.category) ? g.category.trim() : undefined, items: uniq(g.items.filter(ok).map(cleanSkillItem).filter((i) => i.length > 1)) }))
      .filter((g) => g.items.length),
    projects: raw.projects.map((p) => ({ name: p.name.trim(), description: ok(p.description) ? p.description.trim() : undefined })).filter((p) => ok(p.name)),
  }
}

/** «Figma Design tool- 100%» → «Figma»: un porcentaje de dominio no es una habilidad escrita; se queda el nombre de la herramienta (primera palabra, copiada). */
export function cleanSkillItem(item: string): string {
  const t = item.trim()
  if (!/\d{1,3}\s*%/.test(t)) return t
  return t.split(/\s+/)[0].replace(/[^\p{L}\p{N}+#.]+$/u, "")
}

export type ExtrasResult = { extras: AtsExtras; reason?: "sin-texto" | "ia-no-disponible" }

/** Solo se pide lectura profunda cuando algo quedó vacío o roto en el análisis general (los puestos sin viñetas, habilidades sospechosas, nada de proyectos). */
export async function extractExtras(cv: CV, sourceText: string | undefined, opts: { provider?: AIProvider; signal?: AbortSignal } = {}): Promise<ExtrasResult> {
  const source = sourceText?.trim()
  if (!source || source.length < 200) return { extras: EMPTY_EXTRAS, reason: "sin-texto" }
  try {
    const provider = opts.provider ?? getProvider({ temperature: 0 })
    const res = await provider.generateStructured({
      system: SYSTEM,
      user: `${digest(cv)}\n\nTEXTO ORIGINAL (líneas numeradas):\n${numbered(source)}`,
      schema: extrasSchema,
      signal: opts.signal,
      options: { numPredict: 2000 },
    })
    return { extras: groundExtras(res.data, source) }
  } catch {
    return { extras: EMPTY_EXTRAS, reason: "ia-no-disponible" }
  }
}

/** Vuelve a comprobar extras que llegan de fuera (el cliente los devuelve para no repetir la lectura): todo texto debe seguir estando en el original. */
export function regroundExtras(e: AtsExtras, source: string): AtsExtras {
  const hay = ` ${comparable(source)} `
  const ok = (s: string | undefined): s is string => !!s && s.trim().length > 1 && hay.includes(` ${comparable(s)} `)
  return {
    roles: e.roles.filter((r) => ok(r.company)).map((r) => ({ ...r, role: ok(r.role) ? r.role : undefined, location: ok(r.location) ? r.location : undefined, startDate: ok(r.startDate) || r.startDate === undefined ? r.startDate : undefined, endDate: ok(r.endDate) || r.endDate === undefined ? r.endDate : undefined, companyNote: ok(r.companyNote) ? r.companyNote : undefined, bullets: r.bullets.filter(ok) })),
    certifications: e.certifications.filter(ok),
    volunteering: e.volunteering.filter(ok),
    skillGroups: e.skillGroups.map((g) => ({ category: ok(g.category) ? g.category : undefined, items: g.items.filter(ok) })).filter((g) => g.items.length),
    projects: e.projects.filter((p) => ok(p.name)).map((p) => ({ name: p.name, description: ok(p.description) ? p.description : undefined })),
  }
}
