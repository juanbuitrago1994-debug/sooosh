import { fold } from "@/lib/keywords/normalize"

/**
 * Sectorización DETERMINISTA del texto de un CV por sus encabezados (es/en). Sin IA: es la base que permite
 * usar el modelo solo en llamadas pequeñas y específicas.
 */
export type SectionKind = "summary" | "experience" | "education" | "skills" | "languages" | "projects" | "certifications" | "volunteering" | "awards" | "publications" | "other"
export type Section = { kind: SectionKind; title: string; text: string; order: number }

const HEADINGS: Record<Exclude<SectionKind, "other">, string[]> = {
  summary: ["perfil", "perfil profesional", "resumen", "resumen profesional", "sobre mi", "acerca de mi", "objetivo", "objetivo profesional", "summary", "profile", "professional summary", "about me", "objective", "career objective"],
  experience: ["experiencia", "experiencia laboral", "experiencia profesional", "historial laboral", "trayectoria", "trayectoria profesional", "experience", "work experience", "professional experience", "employment", "employment history", "work history"],
  education: ["educacion", "formacion", "formacion academica", "estudios", "estudios realizados", "education", "academic background", "academic education"],
  skills: ["habilidades", "skills", "competencias", "conocimientos", "tecnologias", "stack", "stack tecnologico", "herramientas", "technical skills", "habilidades tecnicas", "aptitudes", "tools", "technologies", "core skills"],
  languages: ["idiomas", "lenguas", "languages"],
  projects: ["proyectos", "projects", "proyectos destacados", "personal projects", "proyectos personales", "selected projects"],
  certifications: ["certificaciones", "certificados", "cursos", "cursos y certificaciones", "certificaciones y cursos", "capacitaciones", "formacion complementaria", "certifications", "courses", "certifications and courses", "licenses and certifications", "licenses & certifications"],
  volunteering: ["voluntariado", "experiencia de voluntariado", "trabajo voluntario", "volunteering", "volunteer experience", "volunteer work"],
  awards: ["premios", "reconocimientos", "premios y reconocimientos", "honores", "awards", "honors", "honors and awards", "honors & awards"],
  publications: ["publicaciones", "publicaciones y charlas", "charlas", "publications", "talks", "publications and talks"],
}

/** Encabezados conocidos que no son parte del esquema: se detectan para no mezclarlos con la sección anterior. */
const OTHER_HEADINGS = [
  "referencias", "intereses", "hobbies", "logros", "datos personales", "informacion adicional", "informacion personal",
  "references", "interests", "achievements", "additional information", "personal information",
]

const normHeading = (line: string) =>
  fold(line)
    .replace(/[:：]+$/g, "")
    .replace(/[^\p{L}\p{N}\s&/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()

/** Distancia de edición (para tolerar errores de OCR como "EXPERTENCIA"). */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}

/** Coincidencia aproximada: solo para encabezados de una palabra de 7+ letras (un error por cada 7 letras como máximo). */
const fuzzyEq = (n: string, name: string) => !n.includes(" ") && name.length >= 7 && n.length >= 7 && n[0] === name[0] && editDistance(n, name) <= (name.length >= 12 ? 2 : 1)

/** ¿Esta línea es un encabezado de sección? Devuelve su tipo o null. */
export function headingKind(line: string): { kind: SectionKind; title: string } | null {
  const t = line.trim()
  if (!t || t.length > 40 || /[@@]|\d{4}/.test(t)) return null
  const n = normHeading(t)
  if (!n) return null
  const title = t.replace(/[:：]+$/, "").trim()
  for (const [kind, names] of Object.entries(HEADINGS)) if (names.includes(n)) return { kind: kind as SectionKind, title }
  if (OTHER_HEADINGS.includes(n)) return { kind: "other", title }
  // Errores de OCR ("EXPERTENCIA", "EDUCAC1ÓN"): coincidencia aproximada, después de descartar las exactas.
  for (const [kind, names] of Object.entries(HEADINGS)) if (names.some((name) => fuzzyEq(n, name))) return { kind: kind as SectionKind, title }
  if (OTHER_HEADINGS.some((name) => fuzzyEq(n, name))) return { kind: "other", title }
  return null
}

export function splitSections(text: string): { header: string; sections: Section[] } {
  const lines = text.split("\n")
  const headerLines: string[] = []
  const sections: Section[] = []
  let cur: { kind: SectionKind; title: string; lines: string[] } | null = null
  for (const line of lines) {
    const h = headingKind(line)
    if (h) {
      if (cur) sections.push({ kind: cur.kind, title: cur.title, text: cur.lines.join("\n").trim(), order: sections.length })
      cur = { ...h, lines: [] }
    } else if (cur) cur.lines.push(line)
    else headerLines.push(line)
  }
  if (cur) sections.push({ kind: cur.kind, title: cur.title, text: cur.lines.join("\n").trim(), order: sections.length })
  return { header: headerLines.join("\n").trim(), sections: sections.filter((s) => s.text) }
}
