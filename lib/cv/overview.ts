import { skillMentions } from "@/lib/analysis/offer-profile"
import type { SkillCategory } from "@/lib/taxonomy/skills"
import type { CV } from "@/lib/schemas/cv"
import type { Diagnosis } from "@/lib/schemas/diagnosis"

/**
 * Resumen CORTO de lo que se leyó del CV, para la pantalla «Perfil» (sin análisis ni consejos).
 * Todo sale del propio CV: el nombre, las empresas y los años vienen de lo extraído; las habilidades son las de la taxonomía
 * que el CV nombra (por su nombre o un alias); nunca se añade una que el CV no mencione.
 */
export type Overview = {
  name?: string
  headline?: string
  location?: string
  email?: string
  phone?: string
  links: { label: string; url: string }[]
  years: number | null
  jobCount: number
  companies: string[]
  skills: string[]
  profile?: string
  sectionTitles: string[]
}

/** Para el resumen solo herramientas, técnicas y certificaciones (las transversales y de dominio son demasiado genéricas). */
const CATEGORIES: SkillCategory[] = ["tool", "tech", "cert"]
const MAX_SKILLS = 10
const MAX_PROFILE = 300

/** Dos primeras frases del perfil, sin pasar de ~300 caracteres. */
export function shortProfile(summary?: string): string | undefined {
  const t = summary?.replace(/\s+/g, " ").trim()
  if (!t) return undefined
  const sentences = t.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g)?.map((x) => x.trim()) ?? [t]
  let out = ""
  for (const s of sentences.slice(0, 2)) {
    if (out && (out + " " + s).length > MAX_PROFILE) break
    out = out ? `${out} ${s}` : s
  }
  return out.length > MAX_PROFILE ? out.slice(0, MAX_PROFILE - 1).trimEnd() + "…" : out
}

const validSkillItem = (s: string) => s.length <= 32 && s.split(/\s+/).length <= 4 && !/[.:;%]$|\d{2}\s*%/.test(s)

export function buildOverview(cv: CV, diagnosis: Diagnosis | undefined, sourceText: string): Overview {
  const companies = [...new Set(cv.experience.map((e) => e.company.trim()).filter((c) => c && !c.startsWith("(")))]
  const fromTaxonomy = skillMentions(sourceText)
    .filter((m) => CATEGORIES.includes(m.skill.category))
    .map((m, i) => ({ m, i }))
    .sort((a, b) => b.m.count - a.m.count || a.i - b.i)
    .map((x) => x.m.skill.label)
  const declared = cv.skills.flatMap((g) => g.items).filter(validSkillItem)
  const skills = [...new Set([...fromTaxonomy, ...(fromTaxonomy.length < 6 ? declared : [])])].slice(0, MAX_SKILLS)
  return {
    name: cv.header.fullName && cv.header.fullName !== "Sin nombre" ? cv.header.fullName : undefined,
    headline: cv.header.headline,
    location: cv.header.location,
    email: cv.header.email,
    phone: cv.header.phone,
    links: cv.header.links,
    years: diagnosis?.seniority.years ?? null,
    jobCount: cv.experience.length,
    companies,
    skills,
    profile: shortProfile(cv.summary),
    sectionTitles: [...new Set((diagnosis?.sections ?? []).map((s) => s.title))],
  }
}
