import { z } from "zod"

const text = (max = 500) => z.string().trim().max(max)
/** Fecha tal como aparece en el CV: "2023", "Mar 2021", "03/2021", "Actual"… Texto libre para no deformar lo que dice el original. */
const partialDate = text(40)
/** Enlace tal como aparece ("linkedin.com/in/ana"); no se exige esquema https://. */
const link = text(300)

export const headerSchema = z.object({
  fullName: text(120).min(1, "Requerido"),
  headline: text(160).optional(),
  email: text(120).optional(),
  phone: text(40).optional(),
  location: text(120).optional(),
  links: z
    .array(z.object({ label: text(60), url: link }))
    .default([]),
})

export const experienceSchema = z.object({
  company: text(120).min(1),
  role: text(120).min(1),
  location: text(120).optional(),
  startDate: partialDate,
  endDate: partialDate.optional(),
  bullets: z.array(text(400).min(1)).default([]),
})

export const educationSchema = z.object({
  institution: text(160).min(1),
  degree: text(160).optional(),
  field: text(160).optional(),
  startDate: partialDate.optional(),
  endDate: partialDate.optional(),
  details: z.array(text(300).min(1)).default([]),
})

export const skillGroupSchema = z.object({
  category: text(80).optional(),
  items: z.array(text(60).min(1)).min(1),
})

export const languageSchema = z.object({
  name: text(60).min(1),
  level: text(60).optional(), // p. ej. "Nativo", "C1", "Intermedio"
})

export const projectSchema = z.object({
  name: text(120).min(1),
  description: text(600).optional(),
  url: link.optional(),
  technologies: z.array(text(60).min(1)).default([]),
  bullets: z.array(text(400).min(1)).default([]),
})

export const SECTION_KEYS = ["summary", "experience", "education", "skills", "languages", "projects"] as const
export type SectionKey = (typeof SECTION_KEYS)[number]

export const cvSchema = z.object({
  header: headerSchema,
  summary: text(1200).optional(),
  experience: z.array(experienceSchema).default([]),
  education: z.array(educationSchema).default([]),
  skills: z.array(skillGroupSchema).default([]),
  languages: z.array(languageSchema).default([]),
  projects: z.array(projectSchema).default([]),
  /** Orden en que se muestran las secciones; si falta, el estándar (resumen, experiencia, educación, habilidades, idiomas, proyectos). */
  sectionOrder: z.array(z.enum(SECTION_KEYS)).optional(),
})

export type CV = z.infer<typeof cvSchema>
export type CVHeader = z.infer<typeof headerSchema>
export type CVExperience = z.infer<typeof experienceSchema>
export type CVEducation = z.infer<typeof educationSchema>
export type CVSkillGroup = z.infer<typeof skillGroupSchema>
export type CVLanguage = z.infer<typeof languageSchema>
export type CVProject = z.infer<typeof projectSchema>
