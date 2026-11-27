import { z } from "zod"
import type { Section, SectionKind } from "./sections"
import { headingKind } from "./sections"

/**
 * Segmentación asistida por IA para CVs SIN encabezados reconocibles (un Word «lleno de datos», un CV de una sola columna sin títulos).
 * Lección medida en docs/BENCHMARKS.md: un modelo de 7B es fiable señalando NÚMEROS de línea y poco fiable copiando texto.
 * Por eso al modelo se le da el texto con las líneas numeradas y solo devuelve «la sección X empieza en la línea N»
 * (≈ 40 tokens de salida). El contenido de cada sección es siempre el texto original, línea por línea.
 */
export const KINDS = ["summary", "experience", "education", "skills", "languages", "projects", "other"] as const satisfies readonly SectionKind[]

export const segmentSchema = z.object({
  sections: z.array(z.object({ kind: z.enum(KINDS), line: z.number().int().min(0) })).max(12),
})
export type Segmentation = z.infer<typeof segmentSchema>

const TITLES: Record<SectionKind, string> = { summary: "Resumen", experience: "Experiencia", education: "Educación", skills: "Habilidades", languages: "Idiomas", projects: "Proyectos", certifications: "Certificaciones", volunteering: "Voluntariado", awards: "Premios", publications: "Publicaciones", other: "Otros" }

export const SEGMENT_PROMPT = `Recibes un CV con las líneas numeradas («N: texto»). No tiene títulos de sección claros. Indica en qué número de línea EMPIEZA cada sección y de qué tipo es: "summary" (perfil o presentación), "experience" (puestos de trabajo con empresa y fechas), "education" (estudios), "skills" (habilidades y herramientas), "languages" (idiomas), "projects" (proyectos), "other" (cualquier otra cosa). Devuelve únicamente {"sections": [{"kind": "...", "line": N}]} en orden de aparición. Usa solo números de línea que existan. Si no existe una sección, no la incluyas.`

/** Texto numerado para el modelo: solo líneas con contenido, recortadas; el número es el de la línea original. */
export function numberLines(lines: string[], maxChars = 6000): string {
  const out: string[] = []
  let used = 0
  lines.forEach((l, i) => {
    const t = l.trim()
    if (!t || used > maxChars) return
    const row = `${i}: ${t.slice(0, 140)}`
    used += row.length + 1
    out.push(row)
  })
  return out.join("\n")
}

/**
 * Convierte la respuesta del modelo en secciones + encabezado. Valida todo: líneas existentes, orden creciente, sin duplicados.
 * Devuelve null si no sirve (el llamador usa su respaldo). Si la primera línea de una sección es un título corto
 * («Trayectoria»), se toma como título y no como contenido.
 */
export function applySegmentation(lines: string[], seg: Segmentation): { header: string; sections: Section[] } | null {
  const picks = seg.sections
    .filter((s) => s.line < lines.length && lines[s.line].trim())
    .sort((a, b) => a.line - b.line)
    .filter((s, i, arr) => i === 0 || s.line > arr[i - 1].line)
  if (!picks.some((p) => p.kind === "experience")) return null
  const sections: Section[] = []
  picks.forEach((p, i) => {
    const end = i + 1 < picks.length ? picks[i + 1].line : lines.length
    const first = lines[p.line].trim()
    const shortLabel = first.split(/\s+/).length <= 2 && /^[\p{L} ]+$/u.test(first) && p.kind !== "summary" && p.kind !== "experience"
    const isTitle = !!headingKind(first) || shortLabel
    const body = lines.slice(isTitle ? p.line + 1 : p.line, end).join("\n").trim()
    if (body) sections.push({ kind: p.kind, title: isTitle ? first : TITLES[p.kind], text: body, order: sections.length })
  })
  if (!sections.some((s) => s.kind === "experience")) return null
  return { header: lines.slice(0, picks[0].line).join("\n").trim(), sections }
}
